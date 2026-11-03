-- Colours offered on every product are chosen once in the dashboard; each product picks its materials.
alter table store_settings add column if not exists colours jsonb not null default '[]';
alter table products add column if not exists materials text[] not null default '{PETG}';

-- Every product gets a Material option, set to PETG, in its first free option slot.
with slots as (
  select product_id,
    case
      when bool_or(lower(option1_name) = 'material' or lower(option2_name) = 'material' or lower(option3_name) = 'material') then 0
      when bool_and(option2_name = '') then 2
      when bool_and(option3_name = '') then 3
      else 0
    end as slot
  from variants
  group by product_id
)
update variants v set
  option2_name = case when s.slot = 2 then 'Material' else v.option2_name end,
  option2_value = case when s.slot = 2 then 'PETG' else v.option2_value end,
  option3_name = case when s.slot = 3 then 'Material' else v.option3_name end,
  option3_value = case when s.slot = 3 then 'PETG' else v.option3_value end,
  title = concat_ws(' / ',
    nullif(nullif(v.option1_value, ''), 'Default Title'),
    nullif(case when s.slot = 2 then 'PETG' else v.option2_value end, ''),
    nullif(case when s.slot = 3 then 'PETG' else v.option3_value end, ''))
from slots s
where s.product_id = v.product_id and s.slot > 0;
