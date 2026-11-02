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

create policy "Org members can view price history" on price_history
  for all using (org_id in (select org_id from org_users where user_id = auth.uid()));
