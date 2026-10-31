-- Keep selling every variant when stock reaches zero.
update variants
set inventory_policy = 'continue', available = true;
