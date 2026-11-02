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
