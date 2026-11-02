-- Dispatches
create table dispatches (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  from_warehouse_id uuid not null references warehouses(id),
  to_site_id uuid not null references sites(id),
  dispatch_number text unique not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'DISPATCHED', 'ACKNOWLEDGED')),
  receiver_name text not null,
  receiver_signature text,
  dispatch_note text,
  dispatched_by uuid not null references auth.users(id),
  dispatched_at timestamptz not null default now()
);

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
