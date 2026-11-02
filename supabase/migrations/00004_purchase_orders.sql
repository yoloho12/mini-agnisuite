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
  status text not null default 'PENDING' check (status in ('PENDING', 'PARTIAL', 'RECEIVED'))
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
  received_at timestamptz not null default now()
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
