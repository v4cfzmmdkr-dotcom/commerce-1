-- A rate applies when the merchandise subtotal is inside an inclusive range.
-- Null on either side means that side is unbounded.

alter table shipping_rates
  add column if not exists min_subtotal_cents integer,
  add column if not exists max_subtotal_cents integer;

alter table shipping_rates
  drop constraint if exists shipping_rates_subtotal_bounds;

alter table shipping_rates
  add constraint shipping_rates_subtotal_bounds
  check (
    (min_subtotal_cents is null or min_subtotal_cents >= 0)
    and (max_subtotal_cents is null or max_subtotal_cents >= 0)
    and (
      min_subtotal_cents is null
      or max_subtotal_cents is null
      or min_subtotal_cents <= max_subtotal_cents
    )
  );
