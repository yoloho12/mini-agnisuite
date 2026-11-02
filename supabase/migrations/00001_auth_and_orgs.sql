-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'viewer' check (role in ('owner', 'manager', 'staff_warehouse', 'staff_site', 'viewer')),
  avatar_url text,
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
