-- Used by the Supabase data API path when an order is paid. Variant ids are text.
drop function if exists decrement_variant_inventory(uuid, integer);

create or replace function decrement_variant_inventory(p_variant_id text, p_qty integer)
returns boolean
language sql
security definer
set search_path = public
as $$
  with updated as (
    update variants
    set inventory_qty = inventory_qty - p_qty
    where id = p_variant_id
      and (inventory_policy = 'continue' or inventory_qty >= p_qty)
    returning 1
  )
  select count(*) > 0 from updated
$$;

revoke execute on function decrement_variant_inventory(text, integer) from public;

do $$ begin if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke execute on function decrement_variant_inventory(text, integer) from anon, authenticated'; end if; if exists (select 1 from pg_roles where rolname = 'service_role') then execute 'grant execute on function decrement_variant_inventory(text, integer) to service_role'; end if; end $$;
