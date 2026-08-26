-- Users & roles
create table if not exists users (
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
create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users(id),
  balance numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

create table if not exists wallet_semester_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  semester text not null,
  amount numeric(10,2) not null default 2000,
  fee_receipt_id uuid,
  credited_at timestamptz default now(),
  unique (user_id, semester)
);

create table if not exists fee_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  semester text not null,
  receipt_file_url text not null,
  status text check (status in ('pending','approved','rejected')) not null default 'pending',
  uploaded_at timestamptz default now(),
  reviewed_by uuid references users(id),
  reviewed_at timestamptz
);

-- Unified payments ledger
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  service text check (service in ('canteen','store','laundry','wallet_topup','fee_credit')) not null,
  amount numeric(10,2) not null,
  method text check (method in ('cashfree_upi','wallet','admin_credit')) not null,
  gateway_txn_id text,
  status text check (status in ('success','failed','pending')) not null default 'pending',
  order_ref text,
  created_at timestamptz default now()
);

-- Canteen
create table if not exists canteen_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  quantity_available int not null default 0,
  prep_time_min int not null default 10,
  is_available boolean not null default true,
  daily_limit int,
  category text
);

create table if not exists canteen_orders (
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

-- Hostel Store
create table if not exists store_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null,
  quantity_available int not null default 0,
  is_available boolean not null default true
);

create table if not exists store_orders (
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

-- Laundry
create table if not exists laundry_services (
  id uuid primary key default gen_random_uuid(),
  name text check (name in ('wash_only','wash_dry','wash_dry_iron','iron_only')) not null,
  price numeric(10,2) not null,
  est_duration_min int not null
);

create table if not exists laundry_orders (
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

-- Indexes
create index if not exists idx_canteen_orders_user_id on canteen_orders(user_id);
create index if not exists idx_canteen_orders_status on canteen_orders(status);
create index if not exists idx_store_orders_user_id on store_orders(user_id);
create index if not exists idx_laundry_orders_user_id on laundry_orders(user_id);
create index if not exists idx_fee_receipts_user_semester on fee_receipts(user_id, semester);
