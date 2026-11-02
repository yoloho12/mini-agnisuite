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

create policy "Recipients can read organization notifications"
  on user_notifications for select
  using (
    recipient_id = auth.uid()
    and org_id in (select org_id from org_users where user_id = auth.uid())
  );

create policy "Organization members can send notifications"
  on user_notifications for insert
  with check (
    actor_id = auth.uid()
    and org_id in (select org_id from org_users where user_id = auth.uid())
    and recipient_id in (select user_id from org_users where org_id = user_notifications.org_id)
  );

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
