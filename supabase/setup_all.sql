-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'viewer' check (role in ('owner', 'manager', 'staff_warehouse', 'staff_site', 'viewer')),
  avatar_url text,
  site_id uuid,
  signature text,
  created_at timestamptz not null default now()
);

-- Organizations
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  base_currency text not null default 'MMK' check (base_currency in ('MMK', 'USD')),
  usd_rate numeric not null default 2100,
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Organization Users (junction)
create table org_users (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'manager', 'staff_warehouse', 'staff_site', 'viewer')),
  assigned_locations jsonb not null default '[]',
  unique(org_id, user_id)
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- RLS
alter table profiles enable row level security;
alter table organizations enable row level security;
alter table org_users enable row level security;

-- Profiles: users can read all profiles in their org, update own profile
create policy "Users can view profiles" on profiles
  for select using (true);

create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

-- Organizations: org members can read their org
create policy "Org members can view" on organizations
  for select using (
    id in (select org_id from org_users where user_id = auth.uid())
  );

create policy "Owners can insert" on organizations
  for insert with check (true);

create policy "Owners can update" on organizations
  for update using (
    id in (select org_id from org_users where user_id = auth.uid() and role = 'owner')
  );

-- Org users
create policy "Org members can view" on org_users
  for select using (
    org_id in (select org_id from org_users where user_id = auth.uid())
  );

create policy "Owners can manage" on org_users
  for all using (
    org_id in (select org_id from org_users where user_id = auth.uid() and role = 'owner')
  );
-- Warehouses
create table warehouses (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  address text,
  contact_person text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Sites
create table sites (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  address text,
  site_type text not null default 'PROJECT' check (site_type in ('BRANCH', 'PROJECT', 'OFFICE', 'OTHER')),
  contact_person text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Pre-set receivers per site
create table site_receivers (
  id uuid primary key default uuid_generate_v4(),
  site_id uuid not null references sites(id) on delete cascade,
  name text not null,
  phone text,
  is_active boolean not null default true
);

-- RLS
alter table warehouses enable row level security;
alter table sites enable row level security;
alter table site_receivers enable row level security;

create policy "Org members can manage warehouses" on warehouses
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

create policy "Org members can manage sites" on sites
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

create policy "Org members can manage receivers" on site_receivers
  for all using (
    site_id in (select id from sites where org_id in (select org_id from org_users where user_id = auth.uid()))
  );
-- Products
create table products (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  sku text not null,
  brand text,
  model text,
  category text,
  color text,
  size text,
  unit text not null default 'pcs',
  barcode_value text,
  barcode_format text check (barcode_format in ('CODE128', 'EAN13', 'QR')),
  reorder_point numeric not null default 0,
  base_cost_mmk bigint not null default 0,
  last_purchase_cost_mmk bigint not null default 0,
  upc_eans jsonb not null default '[]',
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'DISCONTINUED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, sku)
);

-- Stock Levels
create table stock_levels (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  location_type text not null check (location_type in ('WAREHOUSE', 'SITE')),
  location_id uuid not null,
  quantity numeric not null default 0,
  reserved_quantity numeric not null default 0,
  status text not null default 'IN_STOCK' check (status in ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK')),
  updated_at timestamptz not null default now(),
  unique(product_id, location_type, location_id)
);

-- Price History
create table price_history (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  cost_mmk bigint not null,
  usd_rate numeric not null default 2100,
  recorded_at timestamptz not null default now(),
  source text not null default 'PO' check (source in ('PO', 'MANUAL'))
);

-- Auto-update updated_at on products
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_updated_at
  before update on products
  for each row execute procedure update_updated_at();

create trigger stock_levels_updated_at
  before update on stock_levels
  for each row execute procedure update_updated_at();

-- RLS
alter table products enable row level security;
alter table stock_levels enable row level security;
alter table price_history enable row level security;

create policy "Org members can manage products" on products
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

create policy "Org members can manage stock" on stock_levels
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

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

create policy "Org members can view price history" on price_history
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));
-- Contacts (suppliers)
create table contacts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  type text not null default 'SUPPLIER' check (type in ('SUPPLIER', 'OTHER')),
  blacklist_status boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- Purchase Orders
create table purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references contacts(id),
  warehouse_id uuid not null references warehouses(id),
  po_number text unique not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PENDING', 'PARTIAL', 'RECEIVED', 'CANCELLED')),
  currency text not null default 'MMK' check (currency in ('MMK', 'USD')),
  usd_rate numeric not null default 2100,
  total_mmk bigint not null default 0,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PO Line Items
create table po_line_items (
  id uuid primary key default uuid_generate_v4(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  qty_ordered numeric not null default 0,
  qty_received numeric not null default 0,
  unit_cost_mmk bigint not null default 0,
  status text not null default 'PENDING' check (status in ('PENDING', 'PARTIAL', 'RECEIVED')),
  dest_type text not null default 'WAREHOUSE' check (dest_type in ('WAREHOUSE', 'SITE')),
  dest_id uuid
);

-- PO Receipts
create table po_receipts (
  id uuid primary key default uuid_generate_v4(),
  po_id uuid not null references purchase_orders(id),
  org_id uuid not null references organizations(id) on delete cascade,
  slip_number text unique not null,
  supplier_slip_seq int not null,
  received_by uuid not null references auth.users(id),
  received_items jsonb not null default '[]',
  received_at timestamptz not null default now(),
  receiver_signature text
);

-- PO Attachments
create table po_attachments (
  id uuid primary key default uuid_generate_v4(),
  po_id uuid not null references purchase_orders(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  file_type text not null check (file_type in ('PDF', 'IMAGE')),
  file_size_bytes int not null,
  mime_type text not null,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now()
);

-- Auto-update updated_at
create trigger purchase_orders_updated_at
  before update on purchase_orders
  for each row execute procedure update_updated_at();

-- RLS
alter table contacts enable row level security;
alter table purchase_orders enable row level security;
alter table po_line_items enable row level security;
alter table po_receipts enable row level security;
alter table po_attachments enable row level security;

create policy "Org members can manage contacts" on contacts
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

create policy "Org members can manage POs" on purchase_orders
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

create policy "Org members can manage PO line items" on po_line_items
  for all using (
    po_id in (select id from purchase_orders where org_id in (select org_id from org_users where user_id = auth.uid()))
  );

create policy "Org members can manage receipts" on po_receipts
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

create policy "Org members can manage attachments" on po_attachments
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));
-- Dispatches
create table dispatches (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  from_warehouse_id uuid not null references warehouses(id),
  to_site_id uuid not null references sites(id),
  dispatch_number text unique not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'DISPATCHED', 'ACKNOWLEDGED')),
  sender_name text not null default '',
  receiver_name text not null,
  receiver_signature text,
  dispatch_note text,
  dispatched_by uuid not null references auth.users(id),
  dispatched_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null
);
alter table dispatches add column if not exists sender_name text not null default '';
update dispatches
set sender_name = coalesce(nullif(btrim(profiles.full_name), ''), 'Unknown sender')
from profiles
where dispatches.dispatched_by = profiles.id
  and btrim(dispatches.sender_name) = '';

create table dispatch_line_items (
  id uuid primary key default uuid_generate_v4(),
  dispatch_id uuid not null references dispatches(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric not null
);

-- Site Returns
create table site_returns (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  from_site_id uuid not null references sites(id),
  to_warehouse_id uuid not null references warehouses(id),
  origin_dispatch_id uuid references dispatches(id),
  return_number text unique not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'RETURNED', 'ACKNOWLEDGED')),
  sender_name text not null,
  sender_signature text,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table site_return_line_items (
  id uuid primary key default uuid_generate_v4(),
  return_id uuid not null references site_returns(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric not null,
  reason text not null check (reason in ('UNUSED', 'DEFECTIVE', 'WRONG_ITEM', 'PROJECT_COMPLETED', 'OTHER')),
  condition_notes text
);

-- Stock Transfers
create table stock_transfers (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  from_warehouse_id uuid not null references warehouses(id),
  to_warehouse_id uuid not null references warehouses(id),
  transfer_number text unique not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'COMPLETED', 'CANCELLED')),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table transfer_line_items (
  id uuid primary key default uuid_generate_v4(),
  transfer_id uuid not null references stock_transfers(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric not null
);

-- Return to Supplier
create table supplier_returns (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  supplier_id uuid not null references contacts(id),
  warehouse_id uuid not null references warehouses(id),
  return_number text unique not null,
  reason text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'RETURNED', 'ACKNOWLEDGED')),
  items jsonb not null default '[]',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Write-offs
create table write_offs (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_type text not null check (location_type in ('WAREHOUSE', 'SITE')),
  location_id uuid not null,
  product_id uuid not null references products(id),
  quantity numeric not null,
  reason text not null check (reason in ('DAMAGED', 'EXPIRED', 'LOST', 'OTHER')),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

-- Stock Audits
create table audits (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  location_type text not null check (location_type in ('WAREHOUSE', 'SITE')),
  location_id uuid not null,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'COMPLETED')),
  count_sheet jsonb not null default '[]',
  discrepancies jsonb not null default '[]',
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- RLS
alter table dispatches enable row level security;
alter table dispatch_line_items enable row level security;
alter table site_returns enable row level security;
alter table site_return_line_items enable row level security;
alter table stock_transfers enable row level security;
alter table transfer_line_items enable row level security;
alter table supplier_returns enable row level security;
alter table write_offs enable row level security;
alter table audits enable row level security;

create policy "Org members can manage dispatches" on dispatches
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

create policy "Org members can manage dispatch items" on dispatch_line_items
  for all using (
    dispatch_id in (select id from dispatches where org_id in (select org_id from org_users where user_id = auth.uid()))
  );

create policy "Org members can manage returns" on site_returns
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

create policy "Org members can manage return items" on site_return_line_items
  for all using (
    return_id in (select id from site_returns where org_id in (select org_id from org_users where user_id = auth.uid()))
  );

create policy "Org members can manage transfers" on stock_transfers
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

create policy "Org members can manage transfer items" on transfer_line_items
  for all using (
    transfer_id in (select id from stock_transfers where org_id in (select org_id from org_users where user_id = auth.uid()))
  );

create policy "Org members can manage supplier returns" on supplier_returns
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

create policy "Org members can manage write-offs" on write_offs
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));

create policy "Org members can manage audits" on audits
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));
-- Create storage bucket for PO attachments
insert into storage.buckets (id, name, public)
values ('po-attachments', 'po-attachments', false);

-- RLS policies for storage
create policy "Org members can upload PO attachments"
on storage.objects for insert
with check (
  bucket_id = 'po-attachments'
  and (storage.foldername(name))[1] in (
    select org_id::text from org_users where user_id = auth.uid()
  )
);

create policy "Org members can read own PO attachments"
on storage.objects for select
using (
  bucket_id = 'po-attachments'
  and (storage.foldername(name))[1] in (
    select org_id::text from org_users where user_id = auth.uid()
  )
);

create policy "Org members can delete own PO attachments"
on storage.objects for delete
using (
  bucket_id = 'po-attachments'
  and (storage.foldername(name))[1] in (
    select org_id::text from org_users where user_id = auth.uid()
  )
);
-- =====================================================
-- SEED SCRIPT: Create test users + org
-- Run this in Supabase Dashboard â†’ SQL Editor
-- =====================================================

-- 1. Create owner account (password: "password123")
--    The bcrypt hash below is for "password123"
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'owner@agnisuite.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '',
  '{"full_name": "Admin Owner", "email_verified": true}'::jsonb,
  false
)
ON CONFLICT (id) DO NOTHING;

-- 2. Create manager account
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'manager@agnisuite.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '',
  '{"full_name": "Site Manager", "email_verified": true}'::jsonb,
  false
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create staff account
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  raw_user_meta_data,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'staff@agnisuite.com',
  crypt('password123', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '',
  '{"full_name": "Warehouse Staff", "email_verified": true}'::jsonb,
  false
)
ON CONFLICT (id) DO NOTHING;

-- 4. Create profiles for each user
INSERT INTO profiles (id, full_name, role)
SELECT id, 'Admin Owner', 'owner'
FROM auth.users WHERE email = 'owner@agnisuite.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, full_name, role)
SELECT id, 'Site Manager', 'manager'
FROM auth.users WHERE email = 'manager@agnisuite.com'
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, full_name, role)
SELECT id, 'Warehouse Staff', 'staff_warehouse'
FROM auth.users WHERE email = 'staff@agnisuite.com'
ON CONFLICT (id) DO NOTHING;

-- 5. Create default organization
INSERT INTO organizations (id, name, base_currency, usd_rate)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'My Company',
  'MMK',
  2100
)
ON CONFLICT (id) DO NOTHING;

-- 6. Assign all users to the org
INSERT INTO org_users (org_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, 'owner'
FROM auth.users WHERE email = 'owner@agnisuite.com'
ON CONFLICT (org_id, user_id) DO NOTHING;

INSERT INTO org_users (org_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, 'manager'
FROM auth.users WHERE email = 'manager@agnisuite.com'
ON CONFLICT (org_id, user_id) DO NOTHING;

INSERT INTO org_users (org_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, 'staff_warehouse'
FROM auth.users WHERE email = 'staff@agnisuite.com'
ON CONFLICT (org_id, user_id) DO NOTHING;

-- 7. Create sample warehouses
INSERT INTO warehouses (id, org_id, name, address, contact_person, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Main Warehouse', '123 Industrial Zone, Yangon', 'U Kyaw', true),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Backup Storage', '456 Storage Rd, Mandalay', 'Daw Thin', true)
ON CONFLICT (id) DO NOTHING;

-- 8. Create sample sites
INSERT INTO sites (id, org_id, name, address, site_type, contact_person, is_active)
VALUES
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Project Alpha', '789 Construction Site, Bago', 'PROJECT', 'U Aung', true),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'Downtown Office', '321 Office St, Yangon', 'OFFICE', 'Daw Mi', true)
ON CONFLICT (id) DO NOTHING;

-- 9. Create site receivers
INSERT INTO site_receivers (site_id, name, phone, is_active)
SELECT '00000000-0000-0000-0000-000000000020', 'U Aung', '09-123456789', true
WHERE NOT EXISTS (SELECT 1 FROM site_receivers WHERE site_id = '00000000-0000-0000-0000-000000000020' AND name = 'U Aung');

INSERT INTO site_receivers (site_id, name, phone, is_active)
SELECT '00000000-0000-0000-0000-000000000020', 'U Tin', '09-987654321', true
WHERE NOT EXISTS (SELECT 1 FROM site_receivers WHERE site_id = '00000000-0000-0000-0000-000000000020' AND name = 'U Tin');

-- 10. Create sample contacts (suppliers)
INSERT INTO contacts (id, org_id, name, phone, email, type, blacklist_status)
VALUES
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', 'Comet Electronics', '09-111111111', 'comet@email.com', 'SUPPLIER', false),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', 'Yangon Builders Supply', '09-222222222', 'ybs@email.com', 'SUPPLIER', false),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', 'MM Hardware', '09-333333333', 'mmhw@email.com', 'SUPPLIER', false)
ON CONFLICT (id) DO NOTHING;

-- 11. Create sample products
INSERT INTO products (id, org_id, name, sku, brand, model, unit, barcode_value, reorder_point, base_cost_mmk, last_purchase_cost_mmk, status)
VALUES
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000001', 'LED Bulb 9W', 'LED-001', 'Philips', 'CorePro', 'pcs', '5901234123457', 50, 3500, 3500, 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000001', 'Cable 2.5mm 100m', 'CBL-002', 'Best cable', '2.5SQ', 'roll', '5901234123458', 10, 85000, 85000, 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000001', 'PVC Pipe 4 inch', 'PVC-003', 'AG', '4IN', 'pcs', '5901234123459', 20, 12000, 12000, 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000001', 'Cement 50kg', 'CEM-004', 'Myanmar Cement', '50KG', 'bag', '5901234123460', 100, 7500, 7500, 'ACTIVE'),
  ('00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000001', 'Sand (1 ton)', 'SND-005', 'Local', '-', 'lot', null, 5, 45000, 45000, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

-- Done! Login with any of these:
--   owner@agnisuite.com   / password123
--   manager@agnisuite.com / password123
--   staff@agnisuite.com   / password123

-- 12. Migration: per-line PO delivery destination (warehouse or direct-to-site).
-- Safe to run on existing databases; skipped automatically on fresh installs
-- because the columns already exist in the create table above.
ALTER TABLE po_line_items ADD COLUMN IF NOT EXISTS dest_type text not null default 'WAREHOUSE';
ALTER TABLE po_line_items ADD COLUMN IF NOT EXISTS dest_id uuid;
DO $$ BEGIN
  ALTER TABLE po_line_items ADD CONSTRAINT po_line_items_dest_type_check
    CHECK (dest_type in ('WAREHOUSE', 'SITE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 13. Persistent, recipient-scoped in-app notifications.
create table if not exists user_notifications (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('DISPATCH_CREATED', 'DISPATCH_ACKNOWLEDGED')),
  title text not null,
  message text not null,
  href text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists user_notifications_recipient_unread_idx
  on user_notifications (org_id, recipient_id, created_at desc)
  where read_at is null;

alter table user_notifications enable row level security;

DO $$ BEGIN
  create policy "Recipients can read organization notifications"
    on user_notifications for select
    using (
      recipient_id = auth.uid()
      and org_id in (select org_id from org_users where user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "Organization members can send notifications"
    on user_notifications for insert
    with check (
      actor_id = auth.uid()
      and org_id in (select org_id from org_users where user_id = auth.uid())
      and recipient_id in (select user_id from org_users where org_id = user_notifications.org_id)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  create policy "Recipients can mark notifications read"
    on user_notifications for update
    using (
      recipient_id = auth.uid()
      and org_id in (select org_id from org_users where user_id = auth.uid())
    )
    with check (
      recipient_id = auth.uid()
      and org_id in (select org_id from org_users where user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 14. Dispatch creation, detail lines, and stock movement commit or roll back together.
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
    v_org_id, v_from_warehouse, v_to_site,     p_dispatch->>'dispatch_number',
    'DISPATCHED',
    coalesce(
      nullif(btrim(p_dispatch->>'sender_name'), ''),
      (select full_name from profiles where id = v_actor),
      'Unknown sender'
    ), p_dispatch->>'receiver_name', null,
    nullif(p_dispatch->>'dispatch_note', 'null'), v_actor,
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

    select * into v_source from stock_levels
    where org_id = v_org_id and product_id = v_product_id
      and location_type = 'WAREHOUSE' and location_id = v_from_warehouse
    for update;
    if v_source.id is null or v_source.quantity < v_quantity then
      raise exception 'Insufficient stock for product % at source warehouse', v_product_id;
    end if;
    update stock_levels set quantity = quantity - v_quantity,
      status = case
        when quantity - v_quantity <= 0 then 'OUT_OF_STOCK'
        when quantity - v_quantity <= coalesce(reserved_quantity, 0) then 'LOW_STOCK'
        else 'IN_STOCK'
      end,
      updated_at = now()
    where id = v_source.id;

    select * into v_destination from stock_levels
    where org_id = v_org_id and product_id = v_product_id
      and location_type = 'SITE' and location_id = v_to_site
    for update;
    if v_destination.id is null then
      insert into stock_levels (product_id, org_id, location_type, location_id, quantity, reserved_quantity, status)
      values (v_product_id, v_org_id, 'SITE', v_to_site, v_quantity, 0, 'IN_STOCK');
    else
      update stock_levels set quantity = quantity + v_quantity,
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
-- Location-scoped access controls (migration 00013)
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
