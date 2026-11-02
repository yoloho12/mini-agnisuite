create or replace function apply_stock_movement_batch(p_org_id uuid, p_entries jsonb)
returns jsonb
language plpgsql
security definer
as $$
declare
  entry jsonb;
  product_id uuid;
  qty numeric;
  source_type text;
  source_id uuid;
  dest_type text;
  dest_id uuid;
  source_row stock_levels%rowtype;
  dest_row stock_levels%rowtype;
begin
  if p_entries is null or jsonb_array_length(p_entries) = 0 then
    return jsonb_build_object('ok', true, 'count', 0);
  end if;

  for entry in select * from jsonb_array_elements(p_entries)
  loop
    if entry->>'product_id' is null or entry->>'product_id' = '' then
      raise exception 'Every movement needs a product id';
    end if;

    qty := coalesce((entry->>'quantity')::numeric, 0);
    if qty <= 0 then
      raise exception 'Movement quantity must be greater than zero';
    end if;

    product_id := (entry->>'product_id')::uuid;
    source_type := entry->>'from_location_type';
    source_id := nullif(entry->>'from_location_id', '')::uuid;
    dest_type := entry->>'to_location_type';
    dest_id := nullif(entry->>'to_location_id', '')::uuid;

    if source_type is not null and source_id is not null then
      select * into source_row
      from stock_levels
      where org_id = p_org_id
        and product_id = product_id
        and location_type = source_type
        and location_id = source_id
      for update;

      if source_row.id is null then
        raise exception 'No stock found for product % at % %', product_id, source_type, source_id;
      end if;

      if source_row.quantity < qty then
        raise exception 'Insufficient stock for product % at % %: needed %, available %', product_id, source_type, source_id, qty, source_row.quantity;
      end if;

      update stock_levels
      set quantity = quantity - qty,
          status = case
            when quantity - qty <= 0 then 'OUT_OF_STOCK'
            when quantity - qty <= coalesce(reserved_quantity, 0) then 'LOW_STOCK'
            else 'IN_STOCK'
          end,
          updated_at = now()
      where id = source_row.id;
    end if;

    if dest_type is not null and dest_id is not null then
      select * into dest_row
      from stock_levels
      where org_id = p_org_id
        and product_id = product_id
        and location_type = dest_type
        and location_id = dest_id
      for update;

      if dest_row.id is null then
        insert into stock_levels (
          product_id,
          org_id,
          location_type,
          location_id,
          quantity,
          reserved_quantity,
          status,
          updated_at
        ) values (
          product_id,
          p_org_id,
          dest_type,
          dest_id,
          qty,
          0,
          'IN_STOCK',
          now()
        );
      else
        update stock_levels
        set quantity = quantity + qty,
            status = case
              when quantity + qty <= 0 then 'OUT_OF_STOCK'
              when quantity + qty <= coalesce(reserved_quantity, 0) then 'LOW_STOCK'
              else 'IN_STOCK'
            end,
            updated_at = now()
        where id = dest_row.id;
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'count', jsonb_array_length(p_entries));
end;
$$;

grant execute on function apply_stock_movement_batch(uuid, jsonb) to authenticated;
