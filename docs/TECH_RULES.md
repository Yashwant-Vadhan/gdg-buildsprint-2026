# TECH_RULES — Campus Service Hub

## Architecture Overview

- **Frontend:** React (Vite) + Tailwind CSS. Single app, role-based routing (see DESIGN.md IA).
- **Backend-as-a-Service:** Supabase — Postgres database, Auth, Row Level Security, Realtime subscriptions, Edge Functions (Deno) for anything that needs a secret (Cashfree keys, QR signing key) kept off the client.
- **Payments:** Cashfree Payment Gateway, sandbox mode, UPI only for now — server creates an order + payment session via Cashfree's Orders API, client opens Cashfree's hosted checkout SDK with that session ID.
- **QR generation/verification:** A Supabase Edge Function signs a JSON payload (HMAC-SHA256, secret in Edge Function env) after successful payment; `qrcode.react` renders it client-side; a second Edge Function verifies the signature + order state when an admin scans it.
- **Deployment:** Frontend built and deployed to **Firebase Hosting** (Google), per the team's requirement to deploy via Google tooling. Supabase remains the hosted database/backend layer — see the assumption note below.

> **⚠️ Flagged assumption:** "Must use Google tools for deployment" is interpreted here as *hosting the frontend on Firebase Hosting*. The database/auth/realtime layer stays on Supabase (Postgres) because rebuilding atomic-transaction guarantees and realtime on raw Firestore/Cloud Functions in this timebox is materially riskier. If the actual requirement is a fully Google-native stack (Firestore instead of Postgres), that changes the schema and the atomic-write approach in §5 below — confirm this in the first 15 minutes, not at Hour 5.

```
┌────────────────────────────────────┐
│  React (Vite) — Firebase Hosting     │  ← Google deployment target
│  Student views | Admin views | Committee views │
└────────────────┬─────────────────────┘
                  │ Supabase JS client (auth, CRUD, realtime)
                  ▼
┌────────────────────────────────────┐
│              Supabase                │
│  Postgres · Auth · RLS · Realtime    │
│  RPC functions (atomic stock/wallet) │
│  Edge Functions (Cashfree, QR sign)  │
└────────────────┬─────────────────────┘
                  │ server-to-server API calls
                  ▼
┌────────────────────────────────────┐
│        Cashfree (sandbox)            │
│  Orders API → payment_session_id     │
│  Webhook → payment status callback   │
└────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Purpose | Why Chosen | Alternatives Considered |
|---|---|---|---|---|
| Frontend framework | React + Vite | UI | Team's existing React familiarity; Vite is fast to scaffold | Next.js (heavier, SSR not needed here) |
| Styling | Tailwind CSS | Fast, consistent styling without a design tool | Speed for hackathon timeline | Plain CSS (slower) |
| Database | Supabase (Postgres) | Relational data, atomic transactions, RLS | Team has Postgres experience; atomic RPC functions solve overselling directly | Firebase Firestore (weaker fit for relational joins + true row-level transactions) |
| Auth | Supabase Auth | Login/session/role management | Built-in, avoids hand-written JWT/session code | Firebase Auth (viable, but splits the stack across two vendors) |
| Realtime | Supabase Realtime | Live queue/stock/status updates | Native Postgres change subscriptions, no custom WebSocket server | Firestore realtime listeners, custom Socket.io server |
| Payments | Cashfree (sandbox, UPI) | Canteen payment, wallet top-up | Explicit requirement | — |
| QR | `qrcode.react` (gen) + a browser QR-scan lib (e.g. `html5-qrcode`) | Pickup verification | Lightweight, no native app needed | Native camera QR APIs (more setup than time allows) |
| Hosting | Firebase Hosting | Frontend deployment | Explicit requirement (Google tooling) | Vercel/Netlify (not used per requirement) |

## Folder Structure

```
campus-service-hub/
├── src/
│   ├── components/          # shared UI (Button, Card, StatusStepper, QRDisplay, QRScanner)
│   ├── pages/
│   │   ├── student/         # canteen, store, laundry, wallet, profile
│   │   ├── admin/           # canteen, store, laundry, payments
│   │   └── committee/       # receipts, wallet-log
│   ├── lib/
│   │   ├── supabaseClient.js
│   │   └── cashfree.js
│   ├── hooks/                # useRealtimeOrders, useWallet, useAuth
│   └── routes.jsx
├── supabase/
│   ├── migrations/           # SQL schema (see §6)
│   └── functions/
│       ├── create-cashfree-order/
│       ├── cashfree-webhook/
│       ├── generate-order-qr/
│       └── verify-order-qr/
├── .env.example
├── firebase.json
└── README.md
```

## Database Schema

```sql
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
```

### Atomic operations (RPC functions, called via Supabase RPC — never replicate this logic in application code)

```sql
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
```

## Coding Standards
- **Naming:** `camelCase` for JS/TS variables and functions, `PascalCase` for components, `snake_case` for all database columns/tables (Postgres convention).
- **API standards:** All Edge Functions return `{ success: boolean, data | error }`. Never leak Cashfree or QR-signing secrets in a response body.
- **Error handling:** Every atomic RPC call (`decrement_stock`, `debit_wallet`, `credit_wallet`) raises a named Postgres exception (`out_of_stock`, `insufficient_balance`) that the client maps to a specific user-facing message — never a generic "something went wrong" for these two cases, since students need to know *why* an order failed.
- **Logging:** Console-level logging is fine for a hackathon; no need for a structured logging pipeline.

## Security Rules
- **Authentication:** Supabase Auth (email/roll-number + password).
- **Authorization:** Row Level Security policies per table — students can only read/write their own orders/wallet; admins scoped to their own service's tables; committee scoped to `fee_receipts` and the semester-credit table.
- **Secrets management:** Cashfree client ID/secret and the QR HMAC signing key live only in Supabase Edge Function environment variables — never in frontend code or `.env` files committed to git.
- **QR integrity:** QR payloads are signed server-side (HMAC-SHA256). The verify function re-checks the signature and the order's current status server-side — the client's camera scan is just input, never the source of truth.
- **Webhook verification:** Cashfree webhook calls must be validated against Cashfree's signature header before marking any payment as successful — do not trust an unauthenticated "payment succeeded" ping from the client alone.
- **Rate limiting:** Not implemented given the timebox; acceptable risk for a hackathon demo audience.

## Performance Rules
- **Database indexing:** Index `canteen_orders(user_id)`, `canteen_orders(status)`, `store_orders(user_id)`, `laundry_orders(user_id)`, `fee_receipts(user_id, semester)` (this last one backs the uniqueness check).
- **Realtime scope:** Subscribe only to the current user's orders / the current admin's service queue — not a global "all orders" channel, to stay well inside the free-tier concurrent-connection limit.
- **Frontend:** Route-based code splitting between `/student`, `/admin`, `/committee` bundles (a student's phone never needs to download the admin scanner code).

## Testing Rules (best-effort given the timebox)
- **Priority 1 (must test manually before each review):** concurrent last-item order (open two tabs, order simultaneously, confirm only one succeeds); wallet debit going negative is rejected; a re-uploaded receipt for an already-credited semester is rejected.
- **Unit tests:** Skip formal test suites given the timebox; manual verification of the atomic RPCs is the priority.
- **E2E:** One manual end-to-end run per service (order → pay/debit → QR → admin scan → collected) before each review checkpoint.

## Git Workflow
- **Branches:** `feature/<short-name>` (e.g. `feature/canteen-order-flow`), merge to `main` directly given the 3-person/8-hour scale — no need for a `develop` branch.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`) — keeps the history readable for the GitHub repo judges may look at.
- **PRs:** Optional given the timeline; direct commits to `main` are acceptable, but keep commits small and descriptive.

## Deployment Rules
- **Frontend:** `firebase init hosting` → `npm run build` → `firebase deploy` (Firebase Hosting, Google).
- **Backend:** Supabase project (schema + Edge Functions) deployed via `supabase db push` and `supabase functions deploy`.
- **Environments:** One environment only (no dev/staging/prod split) given the timebox — use Cashfree **sandbox** keys throughout, never live keys.
- **Monitoring:** Not implemented; acceptable for a hackathon demo.
