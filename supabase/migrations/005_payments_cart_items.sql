-- Fixes a real bug in cashfree-webhook: on payment success it had no way to know
-- which item(s)/qty were actually purchased, so it just grabbed an arbitrary
-- canteen_items row with `limit 1`. This column lets create-cashfree-order persist
-- the cart at order-creation time, so the webhook can create the correct order(s).
alter table payments add column if not exists cart_items jsonb;
-- Shape: [{ "item_id": "...", "qty": 2, "price": 40.00 }, ...]
