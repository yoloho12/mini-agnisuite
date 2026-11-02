alter table po_line_items add column if not exists dest_type text not null default 'WAREHOUSE';
alter table po_line_items add column if not exists dest_id uuid;

create or replace function is_org_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from org_users
    where org_id = p_org_id
      and user_id = auth.uid()
  );
$$;

create or replace function can_access_location(
  p_org_id uuid,
  p_location_type text,
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from org_users membership
    where membership.org_id = p_org_id
      and membership.user_id = auth.uid()
      and (
        membership.role in ('owner', 'manager')
        or membership.assigned_locations @> jsonb_build_array(p_location_id::text)
        or membership.assigned_locations @> jsonb_build_array(
          jsonb_build_object('id', p_location_id::text)
        )
        or (
          p_location_type = 'SITE'
          and exists (
            select 1
            from profiles
            where id = auth.uid()
              and site_id = p_location_id
          )
        )
      )
  );
$$;

create or replace function can_access_purchase_order(p_po_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from purchase_orders po
    where po.id = p_po_id
      and can_access_location(po.org_id, 'WAREHOUSE', po.warehouse_id)
      and not exists (
        select 1
        from po_line_items line
        where line.po_id = po.id
          and not can_access_location(
            po.org_id,
            coalesce(line.dest_type, 'WAREHOUSE'),
            case
              when coalesce(line.dest_type, 'WAREHOUSE') = 'SITE'
                then coalesce(line.dest_id, po.warehouse_id)
              else po.warehouse_id
            end
          )
      )
  );
$$;

create or replace function can_manage_org_members(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from org_users
    where org_id = p_org_id
      and user_id = auth.uid()
      and role = 'owner'
  );
$$;

create or replace function can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_profile_id = auth.uid()
    or exists (
      select 1
      from profiles target_profile
      join org_users target_membership
        on target_membership.user_id = target_profile.id
      join org_users current_membership
        on current_membership.org_id = target_membership.org_id
      where target_membership.user_id = p_profile_id
        and current_membership.user_id = auth.uid()
        and (
          current_membership.role in ('owner', 'manager')
          or (
            target_profile.site_id is not null
            and can_access_location(
              target_membership.org_id,
              'SITE',
              target_profile.site_id
            )
          )
        )
    );
$$;

revoke all on function is_org_member(uuid) from public, anon;
revoke all on function can_access_location(uuid, text, uuid) from public, anon;
revoke all on function can_access_purchase_order(uuid) from public, anon;
revoke all on function can_manage_org_members(uuid) from public, anon;
revoke all on function can_view_profile(uuid) from public, anon;
grant execute on function is_org_member(uuid) to authenticated;
grant execute on function can_access_location(uuid, text, uuid) to authenticated;
grant execute on function can_access_purchase_order(uuid) to authenticated;
grant execute on function can_manage_org_members(uuid) to authenticated;
grant execute on function can_view_profile(uuid) to authenticated;

drop policy if exists "Users can view profiles" on profiles;
create policy "Users can view organization profiles" on profiles
  for select using (can_view_profile(id));

revoke update on table profiles from authenticated;
grant update (full_name, avatar_url, signature) on table profiles to authenticated;

drop policy if exists "Org members can view" on org_users;
create policy "Users can view own membership" on org_users
  for select using (user_id = auth.uid());
create policy "Owners can view organization memberships" on org_users
  for select using (can_manage_org_members(org_id));

drop policy if exists "Org members can manage warehouses" on warehouses;
create policy "Assigned members can view warehouses" on warehouses
  for select using (can_access_location(org_id, 'WAREHOUSE', id));
create policy "Managers can manage warehouses" on warehouses
  for all using (
    exists (
      select 1 from org_users
      where org_id = warehouses.org_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  )
  with check (
    exists (
      select 1 from org_users
      where org_id = warehouses.org_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

drop policy if exists "Org members can manage sites" on sites;
create policy "Assigned members can view sites" on sites
  for select using (can_access_location(org_id, 'SITE', id));
create policy "Managers can manage sites" on sites
  for all using (
    exists (
      select 1 from org_users
      where org_id = sites.org_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  )
  with check (
    exists (
      select 1 from org_users
      where org_id = sites.org_id
        and user_id = auth.uid()
        and role in ('owner', 'manager')
    )
  );

drop policy if exists "Org members can manage receivers" on site_receivers;
create policy "Assigned members can view site receivers" on site_receivers
  for select using (
    exists (
      select 1 from sites
      where sites.id = site_receivers.site_id
        and can_access_location(sites.org_id, 'SITE', sites.id)
    )
  );
create policy "Managers can manage site receivers" on site_receivers
  for all using (
    exists (
      select 1 from sites
      join org_users on org_users.org_id = sites.org_id
      where sites.id = site_receivers.site_id
        and org_users.user_id = auth.uid()
        and org_users.role in ('owner', 'manager')
    )
  )
  with check (
    exists (
      select 1 from sites
      join org_users on org_users.org_id = sites.org_id
      where sites.id = site_receivers.site_id
        and org_users.user_id = auth.uid()
        and org_users.role in ('owner', 'manager')
    )
  );

drop policy if exists "Org members can manage stock" on stock_levels;
create policy "Assigned members can view stock" on stock_levels
  for select using (can_access_location(org_id, location_type, location_id));
create policy "Assigned operators can manage stock" on stock_levels
  for all using (
    can_access_location(org_id, location_type, location_id)
    and exists (
      select 1 from org_users
      where org_id = stock_levels.org_id
        and user_id = auth.uid()
        and (
          role in ('owner', 'manager')
          or (role = 'staff_warehouse' and location_type = 'WAREHOUSE')
          or (role = 'staff_site' and location_type = 'SITE')
        )
    )
  )
  with check (
    can_access_location(org_id, location_type, location_id)
    and exists (
      select 1 from org_users
      where org_id = stock_levels.org_id
        and user_id = auth.uid()
        and (
          role in ('owner', 'manager')
          or (role = 'staff_warehouse' and location_type = 'WAREHOUSE')
          or (role = 'staff_site' and location_type = 'SITE')
        )
    )
  );

drop policy if exists "Org members can manage POs" on purchase_orders;
create policy "Assigned members can view purchase orders" on purchase_orders
  for select using (can_access_purchase_order(id));
create policy "Assigned members can manage purchase orders" on purchase_orders
  for all using (can_access_purchase_order(id))
  with check (
    is_org_member(org_id)
    and can_access_location(org_id, 'WAREHOUSE', warehouse_id)
  );

drop policy if exists "Org members can manage PO line items" on po_line_items;
create policy "Assigned members can view PO line items" on po_line_items
  for select using (can_access_purchase_order(po_id));
create policy "Assigned members can manage PO line items" on po_line_items
  for all using (can_access_purchase_order(po_id))
  with check (
    can_access_purchase_order(po_id)
    and exists (
      select 1
      from purchase_orders po
      where po.id = po_line_items.po_id
        and can_access_location(
          po.org_id,
          coalesce(po_line_items.dest_type, 'WAREHOUSE'),
          case
            when coalesce(po_line_items.dest_type, 'WAREHOUSE') = 'SITE'
              then coalesce(po_line_items.dest_id, po.warehouse_id)
            else po.warehouse_id
          end
        )
    )
  );

drop policy if exists "Org members can manage receipts" on po_receipts;
create policy "Assigned members can view PO receipts" on po_receipts
  for select using (can_access_purchase_order(po_id));
create policy "Assigned members can manage PO receipts" on po_receipts
  for all using (can_access_purchase_order(po_id))
  with check (can_access_purchase_order(po_id) and is_org_member(org_id));

drop policy if exists "Org members can manage attachments" on po_attachments;
create policy "Assigned members can view PO attachments" on po_attachments
  for select using (can_access_purchase_order(po_id));
create policy "Assigned members can manage PO attachments" on po_attachments
  for all using (can_access_purchase_order(po_id))
  with check (can_access_purchase_order(po_id) and is_org_member(org_id));

drop policy if exists "Org members can manage dispatches" on dispatches;
create policy "Assigned members can view dispatches" on dispatches
  for select using (
    can_access_location(org_id, 'WAREHOUSE', from_warehouse_id)
    and can_access_location(org_id, 'SITE', to_site_id)
  );
create policy "Assigned members can manage dispatches" on dispatches
  for all using (
    can_access_location(org_id, 'WAREHOUSE', from_warehouse_id)
    and can_access_location(org_id, 'SITE', to_site_id)
  )
  with check (
    is_org_member(org_id)
    and can_access_location(org_id, 'WAREHOUSE', from_warehouse_id)
    and can_access_location(org_id, 'SITE', to_site_id)
  );

drop policy if exists "Org members can manage dispatch items" on dispatch_line_items;
create policy "Assigned members can view dispatch items" on dispatch_line_items
  for select using (
    exists (
      select 1 from dispatches
      where dispatches.id = dispatch_line_items.dispatch_id
        and can_access_location(dispatches.org_id, 'WAREHOUSE', dispatches.from_warehouse_id)
        and can_access_location(dispatches.org_id, 'SITE', dispatches.to_site_id)
    )
  );
create policy "Assigned members can manage dispatch items" on dispatch_line_items
  for all using (
    exists (
      select 1 from dispatches
      where dispatches.id = dispatch_line_items.dispatch_id
        and can_access_location(dispatches.org_id, 'WAREHOUSE', dispatches.from_warehouse_id)
        and can_access_location(dispatches.org_id, 'SITE', dispatches.to_site_id)
    )
  )
  with check (
    exists (
      select 1 from dispatches
      where dispatches.id = dispatch_line_items.dispatch_id
        and can_access_location(dispatches.org_id, 'WAREHOUSE', dispatches.from_warehouse_id)
        and can_access_location(dispatches.org_id, 'SITE', dispatches.to_site_id)
    )
  );

drop policy if exists "Org members can manage returns" on site_returns;
create policy "Assigned members can view site returns" on site_returns
  for select using (
    can_access_location(org_id, 'SITE', from_site_id)
    and can_access_location(org_id, 'WAREHOUSE', to_warehouse_id)
  );
create policy "Assigned members can manage site returns" on site_returns
  for all using (
    can_access_location(org_id, 'SITE', from_site_id)
    and can_access_location(org_id, 'WAREHOUSE', to_warehouse_id)
  )
  with check (
    is_org_member(org_id)
    and can_access_location(org_id, 'SITE', from_site_id)
    and can_access_location(org_id, 'WAREHOUSE', to_warehouse_id)
  );

drop policy if exists "Org members can manage return items" on site_return_line_items;
create policy "Assigned members can view site return items" on site_return_line_items
  for select using (
    exists (
      select 1 from site_returns
      where site_returns.id = site_return_line_items.return_id
        and can_access_location(site_returns.org_id, 'SITE', site_returns.from_site_id)
        and can_access_location(site_returns.org_id, 'WAREHOUSE', site_returns.to_warehouse_id)
    )
  );
create policy "Assigned members can manage site return items" on site_return_line_items
  for all using (
    exists (
      select 1 from site_returns
      where site_returns.id = site_return_line_items.return_id
        and can_access_location(site_returns.org_id, 'SITE', site_returns.from_site_id)
        and can_access_location(site_returns.org_id, 'WAREHOUSE', site_returns.to_warehouse_id)
    )
  )
  with check (
    exists (
      select 1 from site_returns
      where site_returns.id = site_return_line_items.return_id
        and can_access_location(site_returns.org_id, 'SITE', site_returns.from_site_id)
        and can_access_location(site_returns.org_id, 'WAREHOUSE', site_returns.to_warehouse_id)
    )
  );

drop policy if exists "Org members can manage transfers" on stock_transfers;
create policy "Assigned members can view transfers" on stock_transfers
  for select using (
    can_access_location(org_id, 'WAREHOUSE', from_warehouse_id)
    and can_access_location(org_id, 'WAREHOUSE', to_warehouse_id)
  );
create policy "Assigned members can manage transfers" on stock_transfers
  for all using (
    can_access_location(org_id, 'WAREHOUSE', from_warehouse_id)
    and can_access_location(org_id, 'WAREHOUSE', to_warehouse_id)
  )
  with check (
    is_org_member(org_id)
    and can_access_location(org_id, 'WAREHOUSE', from_warehouse_id)
    and can_access_location(org_id, 'WAREHOUSE', to_warehouse_id)
  );

drop policy if exists "Org members can manage transfer items" on transfer_line_items;
create policy "Assigned members can view transfer items" on transfer_line_items
  for select using (
    exists (
      select 1 from stock_transfers
      where stock_transfers.id = transfer_line_items.transfer_id
        and can_access_location(stock_transfers.org_id, 'WAREHOUSE', stock_transfers.from_warehouse_id)
        and can_access_location(stock_transfers.org_id, 'WAREHOUSE', stock_transfers.to_warehouse_id)
    )
  );
create policy "Assigned members can manage transfer items" on transfer_line_items
  for all using (
    exists (
      select 1 from stock_transfers
      where stock_transfers.id = transfer_line_items.transfer_id
        and can_access_location(stock_transfers.org_id, 'WAREHOUSE', stock_transfers.from_warehouse_id)
        and can_access_location(stock_transfers.org_id, 'WAREHOUSE', stock_transfers.to_warehouse_id)
    )
  )
  with check (
    exists (
      select 1 from stock_transfers
      where stock_transfers.id = transfer_line_items.transfer_id
        and can_access_location(stock_transfers.org_id, 'WAREHOUSE', stock_transfers.from_warehouse_id)
        and can_access_location(stock_transfers.org_id, 'WAREHOUSE', stock_transfers.to_warehouse_id)
    )
  );

drop policy if exists "Org members can manage supplier returns" on supplier_returns;
create policy "Assigned members can view supplier returns" on supplier_returns
  for select using (can_access_location(org_id, 'WAREHOUSE', warehouse_id));
create policy "Assigned members can manage supplier returns" on supplier_returns
  for all using (can_access_location(org_id, 'WAREHOUSE', warehouse_id))
  with check (
    is_org_member(org_id)
    and can_access_location(org_id, 'WAREHOUSE', warehouse_id)
  );

drop policy if exists "Org members can manage write-offs" on write_offs;
create policy "Assigned members can view write-offs" on write_offs
  for select using (can_access_location(org_id, location_type, location_id));
create policy "Assigned members can manage write-offs" on write_offs
  for all using (can_access_location(org_id, location_type, location_id))
  with check (
    is_org_member(org_id)
    and can_access_location(org_id, location_type, location_id)
  );

drop policy if exists "Org members can manage audits" on audits;
create policy "Assigned members can view audits" on audits
  for select using (can_access_location(org_id, location_type, location_id));
create policy "Assigned members can manage audits" on audits
  for all using (can_access_location(org_id, location_type, location_id))
  with check (
    is_org_member(org_id)
    and can_access_location(org_id, location_type, location_id)
  );
