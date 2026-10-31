-- Limit every product to Colour: Black and White.

update variants set
  option1_name = 'Colour',
  option1_value = case lower(option1_value) when 'black' then 'Black' when 'white' then 'White' else option1_value end
where lower(option1_name) in ('color', 'colour');

update variants set
  option2_name = 'Colour',
  option2_value = case lower(option2_value) when 'black' then 'Black' when 'white' then 'White' else option2_value end
where lower(option2_name) in ('color', 'colour', 'primary colour', 'primary color');

update variants set
  option3_name = 'Colour',
  option3_value = case lower(option3_value) when 'black' then 'Black' when 'white' then 'White' else option3_value end
where lower(option3_name) in ('color', 'colour');

update variants set option1_value = 'Black'
where option1_name = 'Colour' and lower(option1_value) not in ('black', 'white');
update variants set option2_value = 'Black'
where option2_name = 'Colour' and lower(option2_value) not in ('black', 'white');
update variants set option3_value = 'Black'
where option3_name = 'Colour' and lower(option3_value) not in ('black', 'white');

delete from variants v
using (
  select id, row_number() over (
    partition by product_id, option1_name, option1_value, option2_name, option2_value, option3_name, option3_value
    order by position, id
  ) as rn
  from variants
) d
where v.id = d.id and d.rn > 1
  and not exists (select 1 from order_items oi where oi.variant_id = v.id);

insert into variants (
  id, product_id, sku, title, option1_name, option1_value, option2_name, option2_value,
  option3_name, option3_value, price_cents, compare_at_cents, cost_cents, inventory_qty,
  inventory_policy, weight_grams, taxable, barcode, position, available
)
select
  gen_random_uuid()::text,
  v.product_id,
  case when v.sku <> '' then v.sku || '-W' else '' end,
  regexp_replace(v.title, 'Black', 'White'),
  v.option1_name,
  case when v.option1_name = 'Colour' then 'White' else v.option1_value end,
  v.option2_name,
  case when v.option2_name = 'Colour' then 'White' else v.option2_value end,
  v.option3_name,
  case when v.option3_name = 'Colour' then 'White' else v.option3_value end,
  v.price_cents, v.compare_at_cents, v.cost_cents, v.inventory_qty,
  v.inventory_policy, v.weight_grams, v.taxable, v.barcode, v.position + 50, v.available
from variants v
where (
  (v.option1_name = 'Colour' and v.option1_value = 'Black')
  or (v.option2_name = 'Colour' and v.option2_value = 'Black')
  or (v.option3_name = 'Colour' and v.option3_value = 'Black')
)
and not exists (
  select 1 from variants w
  where w.product_id = v.product_id
    and w.option1_value = case when v.option1_name = 'Colour' then 'White' else v.option1_value end
    and w.option2_value = case when v.option2_name = 'Colour' then 'White' else v.option2_value end
    and w.option3_value = case when v.option3_name = 'Colour' then 'White' else v.option3_value end
);

insert into variants (
  id, product_id, sku, title, option1_name, option1_value, option2_name, option2_value,
  option3_name, option3_value, price_cents, compare_at_cents, cost_cents, inventory_qty,
  inventory_policy, weight_grams, taxable, barcode, position, available
)
select
  gen_random_uuid()::text,
  v.product_id,
  case when v.sku <> '' then v.sku || '-B' else '' end,
  regexp_replace(v.title, 'White', 'Black'),
  v.option1_name,
  case when v.option1_name = 'Colour' then 'Black' else v.option1_value end,
  v.option2_name,
  case when v.option2_name = 'Colour' then 'Black' else v.option2_value end,
  v.option3_name,
  case when v.option3_name = 'Colour' then 'Black' else v.option3_value end,
  v.price_cents, v.compare_at_cents, v.cost_cents, v.inventory_qty,
  v.inventory_policy, v.weight_grams, v.taxable, v.barcode, v.position, v.available
from variants v
where (
  (v.option1_name = 'Colour' and v.option1_value = 'White')
  or (v.option2_name = 'Colour' and v.option2_value = 'White')
  or (v.option3_name = 'Colour' and v.option3_value = 'White')
)
and not exists (
  select 1 from variants b
  where b.product_id = v.product_id
    and b.option1_value = case when v.option1_name = 'Colour' then 'Black' else v.option1_value end
    and b.option2_value = case when v.option2_name = 'Colour' then 'Black' else v.option2_value end
    and b.option3_value = case when v.option3_name = 'Colour' then 'Black' else v.option3_value end
);

update variants set
  option1_name = 'Colour',
  option1_value = 'Black',
  title = 'Black'
where (lower(option1_name) in ('title', '') or lower(option1_value) = 'default title')
  and coalesce(option2_name, '') = ''
  and coalesce(option3_name, '') = '';

insert into variants (
  id, product_id, sku, title, option1_name, option1_value, option2_name, option2_value,
  option3_name, option3_value, price_cents, compare_at_cents, cost_cents, inventory_qty,
  inventory_policy, weight_grams, taxable, barcode, position, available
)
select
  gen_random_uuid()::text, v.product_id,
  case when v.sku <> '' then v.sku || '-W' else '' end,
  'White', 'Colour', 'White', '', '', '', '',
  v.price_cents, v.compare_at_cents, v.cost_cents, v.inventory_qty,
  v.inventory_policy, v.weight_grams, v.taxable, v.barcode, v.position + 1, v.available
from variants v
where v.option1_name = 'Colour' and v.option1_value = 'Black'
  and coalesce(v.option2_name, '') = ''
  and not exists (
    select 1 from variants w
    where w.product_id = v.product_id and w.option1_name = 'Colour' and w.option1_value = 'White'
      and coalesce(w.option2_name, '') = ''
  );

update variants v set
  option2_name = 'Colour',
  option2_value = 'Black',
  title = trim(both ' /' from concat_ws(' /', nullif(v.option1_value, ''), 'Black'))
where coalesce(v.option2_name, '') = ''
  and not exists (
    select 1 from variants x
    where x.product_id = v.product_id
      and (x.option1_name = 'Colour' or x.option2_name = 'Colour' or x.option3_name = 'Colour')
  );

insert into variants (
  id, product_id, sku, title, option1_name, option1_value, option2_name, option2_value,
  option3_name, option3_value, price_cents, compare_at_cents, cost_cents, inventory_qty,
  inventory_policy, weight_grams, taxable, barcode, position, available
)
select
  gen_random_uuid()::text, v.product_id,
  case when v.sku <> '' then v.sku || '-W' else '' end,
  trim(both ' /' from concat_ws(' /', nullif(v.option1_value, ''), 'White')),
  v.option1_name, v.option1_value, 'Colour', 'White', v.option3_name, v.option3_value,
  v.price_cents, v.compare_at_cents, v.cost_cents, v.inventory_qty,
  v.inventory_policy, v.weight_grams, v.taxable, v.barcode, v.position + 50, v.available
from variants v
where v.option2_name = 'Colour' and v.option2_value = 'Black'
  and not exists (
    select 1 from variants w
    where w.product_id = v.product_id
      and w.option1_value = v.option1_value
      and w.option2_name = 'Colour' and w.option2_value = 'White'
      and w.option3_value = v.option3_value
  );

update variants v set
  option3_name = 'Colour',
  option3_value = 'Black',
  title = trim(both ' /' from concat_ws(' /', nullif(v.option1_value, ''), nullif(v.option2_value, ''), 'Black'))
where coalesce(v.option3_name, '') = ''
  and coalesce(v.option2_name, '') <> ''
  and v.option2_name <> 'Colour'
  and v.option1_name <> 'Colour'
  and not exists (
    select 1 from variants x
    where x.product_id = v.product_id and x.option3_name = 'Colour'
  );

insert into variants (
  id, product_id, sku, title, option1_name, option1_value, option2_name, option2_value,
  option3_name, option3_value, price_cents, compare_at_cents, cost_cents, inventory_qty,
  inventory_policy, weight_grams, taxable, barcode, position, available
)
select
  gen_random_uuid()::text, v.product_id,
  case when v.sku <> '' then v.sku || '-W' else '' end,
  trim(both ' /' from concat_ws(' /', nullif(v.option1_value, ''), nullif(v.option2_value, ''), 'White')),
  v.option1_name, v.option1_value, v.option2_name, v.option2_value, 'Colour', 'White',
  v.price_cents, v.compare_at_cents, v.cost_cents, v.inventory_qty,
  v.inventory_policy, v.weight_grams, v.taxable, v.barcode, v.position + 50, v.available
from variants v
where v.option3_name = 'Colour' and v.option3_value = 'Black'
  and not exists (
    select 1 from variants w
    where w.product_id = v.product_id
      and w.option1_value = v.option1_value
      and w.option2_value = v.option2_value
      and w.option3_name = 'Colour' and w.option3_value = 'White'
  );

update variants set title = trim(both ' /' from concat_ws(
  ' /',
  nullif(option1_value, ''),
  nullif(option2_value, ''),
  nullif(option3_value, '')
))
where option1_name = 'Colour' or option2_name = 'Colour' or option3_name = 'Colour';
