alter table dispatches
  add column if not exists sender_name text not null default '';

update dispatches
set sender_name = coalesce(
  nullif(btrim(profiles.full_name), ''),
  'Unknown sender'
)
from profiles
where dispatches.dispatched_by = profiles.id
  and btrim(dispatches.sender_name) = '';

create or replace function create_dispatch_with_stock_batch(
  p_dispatch jsonb,
  p_line_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid := (p_dispatch->>'org_id')::uuid;
  v_dispatch dispatches%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_quantity numeric;
  v_source stock_levels%rowtype;
  v_destination stock_levels%rowtype;
  v_from_warehouse uuid := (p_dispatch->>'from_warehouse_id')::uuid;
  v_to_site uuid := (p_dispatch->>'to_site_id')::uuid;
begin
  if v_actor is null or not exists (
    select 1 from org_users
    where user_id = v_actor
      and org_id = v_org_id
      and (
        role in ('owner', 'manager')
        or (
          role = 'staff_warehouse'
          and (
            assigned_locations @> jsonb_build_array(v_from_warehouse::text)
            or assigned_locations @> jsonb_build_array(
              jsonb_build_object('type', 'WAREHOUSE', 'id', v_from_warehouse::text)
            )
          )
        )
      )
  ) then
    raise exception 'You do not have permission to dispatch stock for this organization';
  end if;

  if jsonb_typeof(p_line_items) <> 'array' or jsonb_array_length(p_line_items) = 0 then
    raise exception 'Add at least one product to dispatch';
  end if;

  if not exists (select 1 from warehouses where id = v_from_warehouse and org_id = v_org_id) then
    raise exception 'Source warehouse not found';
  end if;
  if not exists (select 1 from sites where id = v_to_site and org_id = v_org_id) then
    raise exception 'Destination site not found';
  end if;

  insert into dispatches (
    org_id, from_warehouse_id, to_site_id, dispatch_number, status,
    sender_name, receiver_name, receiver_signature, dispatch_note, dispatched_by, dispatched_at
  ) values (
    v_org_id,
    v_from_warehouse,
    v_to_site,
    p_dispatch->>'dispatch_number',
    'DISPATCHED',
    coalesce(
      nullif(btrim(p_dispatch->>'sender_name'), ''),
      (select full_name from profiles where id = v_actor),
      'Unknown sender'
    ),
    p_dispatch->>'receiver_name',
    null,
    nullif(p_dispatch->>'dispatch_note', 'null'),
    v_actor,
    coalesce((p_dispatch->>'dispatched_at')::timestamptz, now())
  ) returning * into v_dispatch;

  for v_item in select * from jsonb_array_elements(p_line_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::numeric;
    if v_quantity <= 0 or v_quantity <> trunc(v_quantity) then
      raise exception 'Dispatch quantities must be positive whole numbers';
    end if;
    if not exists (select 1 from products where id = v_product_id and org_id = v_org_id) then
      raise exception 'Product not found';
    end if;

    select * into v_source
    from stock_levels
    where org_id = v_org_id
      and product_id = v_product_id
      and location_type = 'WAREHOUSE'
      and location_id = v_from_warehouse
    for update;
    if v_source.id is null or v_source.quantity < v_quantity then
      raise exception 'Insufficient stock for product % at source warehouse', v_product_id;
    end if;

    update stock_levels
    set quantity = quantity - v_quantity,
        status = case
          when quantity - v_quantity <= 0 then 'OUT_OF_STOCK'
          when quantity - v_quantity <= coalesce(reserved_quantity, 0) then 'LOW_STOCK'
          else 'IN_STOCK'
        end,
        updated_at = now()
    where id = v_source.id;

    select * into v_destination
    from stock_levels
    where org_id = v_org_id
      and product_id = v_product_id
      and location_type = 'SITE'
      and location_id = v_to_site
    for update;

    if v_destination.id is null then
      insert into stock_levels (product_id, org_id, location_type, location_id, quantity, reserved_quantity, status)
      values (v_product_id, v_org_id, 'SITE', v_to_site, v_quantity, 0, 'IN_STOCK');
    else
      update stock_levels
      set quantity = quantity + v_quantity,
          status = case
            when quantity + v_quantity <= 0 then 'OUT_OF_STOCK'
            when quantity + v_quantity <= coalesce(reserved_quantity, 0) then 'LOW_STOCK'
            else 'IN_STOCK'
          end,
          updated_at = now()
      where id = v_destination.id;
    end if;

    insert into dispatch_line_items (dispatch_id, product_id, quantity)
    values (v_dispatch.id, v_product_id, v_quantity);
  end loop;

  return to_jsonb(v_dispatch);
end;
$$;

grant execute on function create_dispatch_with_stock_batch(jsonb, jsonb) to authenticated;
