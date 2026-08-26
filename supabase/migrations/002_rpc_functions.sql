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
$$ language plpgsql security definer;

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
$$ language plpgsql security definer;

create or replace function credit_wallet_once_per_semester(p_user_id uuid, p_semester text, p_amount numeric, p_receipt_id uuid)
returns void as $$
begin
  insert into wallet_semester_credits (user_id, semester, amount, fee_receipt_id)
  values (p_user_id, p_semester, p_amount, p_receipt_id);

  update wallets set balance = balance + p_amount where user_id = p_user_id;
end;
$$ language plpgsql security definer;
