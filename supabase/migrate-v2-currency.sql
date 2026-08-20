-- Run once on an existing v2 database created before currency fields were added.
alter table public.trips
  add column if not exists foreign_currency text not null default '',
  add column if not exists exchange_rate numeric;