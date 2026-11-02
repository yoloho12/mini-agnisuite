-- Product category (added after initial schema)
alter table products add column if not exists category text;
