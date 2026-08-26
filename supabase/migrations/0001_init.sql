-- Transcribed verbatim from docs/TECH_RULES.md §Database Schema, to unblock frontend
-- development against real tables. Schema ownership stays with Yashwant.

-- Users & roles
create table users (
  id uuid primary key references auth.users(id),
  name text not null,
  roll_no text unique not null,
  email text,
  phone text,
  user_type text check (user_type in ('day_scholar','hosteller')) not null,
  role text check (role in ('student','canteen_admin','store_admin','laundry_admin','hostel_committee')) not null default 'student',
  hostel_block text,
  room_no text,
  created_at timestamptz default now()
);

-- Shared hostel wallet
create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id),
  balance numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

create table wallet_semester_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  semester text not null,
  amount numeric(10,2) not null default 2000,
  fee_receipt_id uuid,
  credited_at timestamptz default now(),
  unique (user_id, semester)          -- prevents double-crediting the same semester
);

create table fee_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  semester text not null,
  receipt_file_url text not null,
  status text check (status in ('pending','approved','rejected')) not null default 'pending',
  uploaded_at timestamptz default now(),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz
);

-- Unified payments ledger (for turnover/invoice reporting)
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  service text check (service in ('canteen','store','laundry','wallet_topup','fee_credit')) not null,
  amount numeric(10,2) not null,
  method text check (method in ('cashfree_upi','wallet','admin_credit')) not null,
  gateway_txn_id text,
  status text check (status in ('success','failed','pending')) not null default 'pending',
  order_ref text,                      -- free-text pointer to canteen_orders/store_orders/laundry_orders id
  created_at timestamptz default now()
);

-- Canteen
create table canteen_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  quantity_available int not null default 0,
  prep_time_min int not null default 10,
  is_available boolean not null default true,
  daily_limit int,
  category text
);

create table canteen_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  item_id uuid references canteen_items(id),
  qty int not null,
  amount numeric(10,2) not null,
  status text check (status in ('Received','Preparing','Ready','Collected')) not null default 'Received',
  token_no int,
  ordered_at timestamptz default now(),
  estimated_ready_at timestamptz,
  qr_payload text,
  qr_signature text,
  collected_at timestamptz,
  payment_id uuid references payments(id)
);

-- Hostel Store (mirrors Canteen, wallet-paid)
create table store_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  quantity_available int not null default 0,
  is_available boolean not null default true
);

create table store_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  item_id uuid references store_items(id),
  qty int not null,
  amount numeric(10,2) not null,
  status text check (status in ('Received','Preparing','Ready','Collected')) not null default 'Received',
  token_no int,
  ordered_at timestamptz default now(),
  estimated_ready_at timestamptz,
  qr_payload text,
  qr_signature text,
  collected_at timestamptz,
  wallet_txn_id uuid
);

-- Laundry (wallet-paid)
create table laundry_services (
  id uuid primary key default gen_random_uuid(),
  name text check (name in ('wash_only','wash_dry','wash_dry_iron','iron_only')) not null,
  price numeric(10,2) not null,
  est_duration_min int not null
);

create table laundry_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  service_id uuid references laundry_services(id),
  amount numeric(10,2) not null,
  status text check (status in ('Registered','Collected','Washing','Drying','Ironing','Ready','Delivered')) not null default 'Registered',
  registered_at timestamptz default now(),
  estimated_ready_at timestamptz,
  qr_payload text,
  qr_signature text,
  delivered_at timestamptz,
  wallet_txn_id uuid
);

-- Indexes (see Performance Rules)
create index on canteen_orders(user_id);
create index on canteen_orders(status);
create index on store_orders(user_id);
create index on laundry_orders(user_id);
create index on fee_receipts(user_id, semester);

-- Atomic operations (RPC functions, called via Supabase RPC — never replicate this logic in application code)

create or replace function decrement_stock(p_table text, p_item_id uuid, p_qty int)
returns int as $$
declare new_qty int;
begin
  if p_table = 'canteen_items' then
    update canteen_items set quantity_available = quantity_available - p_qty
      where id = p_item_id and quantity_available >= p_qty
      returning quantity_available into new_qty;
  elsif p_table = 'store_items' then
    update store_items set quantity_available = quantity_available - p_qty
      where id = p_item_id and quantity_available >= p_qty
      returning quantity_available into new_qty;
  end if;
  if new_qty is null then
    raise exception 'out_of_stock';
  end if;
  return new_qty;
end;
$$ language plpgsql;

create or replace function debit_wallet(p_wallet_id uuid, p_amount numeric)
returns numeric as $$
declare new_balance numeric;
begin
  update wallets set balance = balance - p_amount
    where id = p_wallet_id and balance >= p_amount
    returning balance into new_balance;
  if new_balance is null then
    raise exception 'insufficient_balance';
  end if;
  return new_balance;
end;
$$ language plpgsql;

create or replace function credit_wallet_once_per_semester(p_user_id uuid, p_semester text, p_amount numeric, p_receipt_id uuid)
returns void as $$
begin
  insert into wallet_semester_credits (user_id, semester, amount, fee_receipt_id)
  values (p_user_id, p_semester, p_amount, p_receipt_id);   -- fails on unique(user_id, semester) if already credited

  update wallets set balance = balance + p_amount where user_id = p_user_id;
end;
$$ language plpgsql;
