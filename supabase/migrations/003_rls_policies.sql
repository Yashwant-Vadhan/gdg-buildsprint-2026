alter table users enable row level security;
alter table wallets enable row level security;
alter table wallet_semester_credits enable row level security;
alter table fee_receipts enable row level security;
alter table payments enable row level security;
alter table canteen_items enable row level security;
alter table canteen_orders enable row level security;
alter table store_items enable row level security;
alter table store_orders enable row level security;
alter table laundry_services enable row level security;
alter table laundry_orders enable row level security;

create or replace function get_my_role()
returns text as $$
  select role from users where id = auth.uid()
$$ language sql security definer stable;

create or replace function get_my_user_type()
returns text as $$
  select user_type from users where id = auth.uid()
$$ language sql security definer stable;

-- Users policies
create policy "Users read profile" on users for select using (id = auth.uid());
create policy "Users update profile" on users for update using (id = auth.uid());
create policy "Users signup profile" on users for insert with check (id = auth.uid());
create policy "Admins read profiles" on users for select using (get_my_role() in ('canteen_admin','store_admin','laundry_admin','hostel_committee'));

-- Wallets policies
create policy "Hostellers read wallet" on wallets for select using (user_id = auth.uid());
create policy "Committee read wallets" on wallets for select using (get_my_role() = 'hostel_committee');

-- Credits policies
create policy "Students read credits" on wallet_semester_credits for select using (user_id = auth.uid());
create policy "Committee read credits" on wallet_semester_credits for select using (get_my_role() = 'hostel_committee');

-- Receipts policies
create policy "Students read receipts" on fee_receipts for select using (user_id = auth.uid());
create policy "Students insert receipts" on fee_receipts for insert with check (user_id = auth.uid());
create policy "Committee read receipts" on fee_receipts for select using (get_my_role() = 'hostel_committee');
create policy "Committee update receipts" on fee_receipts for update using (get_my_role() = 'hostel_committee');

-- Payments policies
create policy "Students read payments" on payments for select using (user_id = auth.uid());
create policy "Students insert payments" on payments for insert with check (user_id = auth.uid());
create policy "Admins read payments" on payments for select using (
  (get_my_role() = 'canteen_admin' and service = 'canteen') or
  (get_my_role() = 'store_admin' and service in ('store','wallet_topup','fee_credit')) or
  (get_my_role() = 'laundry_admin' and service = 'laundry') or
  get_my_role() = 'hostel_committee'
);

-- Canteen items policies
create policy "Anyone read canteen items" on canteen_items for select using (auth.uid() is not null);
create policy "Admin insert canteen items" on canteen_items for insert with check (get_my_role() = 'canteen_admin');
create policy "Admin update canteen items" on canteen_items for update using (get_my_role() = 'canteen_admin');

-- Canteen orders policies
create policy "Students read canteen orders" on canteen_orders for select using (user_id = auth.uid());
create policy "Students insert canteen orders" on canteen_orders for insert with check (user_id = auth.uid());
create policy "Admin read canteen orders" on canteen_orders for select using (get_my_role() = 'canteen_admin');
create policy "Admin update canteen orders" on canteen_orders for update using (get_my_role() = 'canteen_admin');

-- Store items policies
create policy "Hostellers read store items" on store_items for select using (auth.uid() is not null and (get_my_user_type() = 'hosteller' or get_my_role() = 'store_admin'));
create policy "Admin insert store items" on store_items for insert with check (get_my_role() = 'store_admin');
create policy "Admin update store items" on store_items for update using (get_my_role() = 'store_admin');

-- Store orders policies
create policy "Hostellers read store orders" on store_orders for select using (user_id = auth.uid());
create policy "Hostellers insert store orders" on store_orders for insert with check (user_id = auth.uid() and get_my_user_type() = 'hosteller');
create policy "Admin read store orders" on store_orders for select using (get_my_role() = 'store_admin');
create policy "Admin update store orders" on store_orders for update using (get_my_role() = 'store_admin');

-- Laundry services policies
create policy "Hostellers read laundry services" on laundry_services for select using (auth.uid() is not null and (get_my_user_type() = 'hosteller' or get_my_role() = 'laundry_admin'));

-- Laundry orders policies
create policy "Hostellers read laundry orders" on laundry_orders for select using (user_id = auth.uid());
create policy "Hostellers insert laundry orders" on laundry_orders for insert with check (user_id = auth.uid() and get_my_user_type() = 'hosteller');
create policy "Admin read laundry orders" on laundry_orders for select using (get_my_role() = 'laundry_admin');
create policy "Admin update laundry orders" on laundry_orders for update using (get_my_role() = 'laundry_admin');
