insert into canteen_items (name, price, quantity_available, prep_time_min, is_available, category) values
('Masala Dosa', 40.00, 50, 10, true, 'Breakfast'),
('Idli (2 Pcs)', 20.00, 100, 5, true, 'Breakfast'),
('Veg Biryani', 70.00, 30, 15, true, 'Lunch'),
('Samosa', 15.00, 80, 5, true, 'Snacks'),
('Cold Coffee', 30.00, 40, 5, true, 'Beverages')
on conflict do nothing;

insert into store_items (name, price, quantity_available, is_available) values
('Potato Chips', 20.00, 50, true),
('Chocolate Bar', 10.00, 100, true),
('Soft Drink (Can)', 35.00, 40, true),
('Instant Noodles', 15.00, 60, true),
('Salted Peanuts', 10.00, 80, true)
on conflict do nothing;

insert into laundry_services (name, price, est_duration_min) values
('wash_only', 15.00, 120),
('wash_dry', 25.00, 240),
('wash_dry_iron', 35.00, 360),
('iron_only', 10.00, 60)
on conflict do nothing;
