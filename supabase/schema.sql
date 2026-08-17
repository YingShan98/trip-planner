-- Trip Planner generic schema
-- Run this once in Supabase SQL Editor.
-- Before running, replace CHANGE_ME_ADMIN_PASSWORD with your own private admin password.

create extension if not exists pgcrypto;

create table if not exists public.trip_documents (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  title text not null,
  destination text not null default '',
  start_date date,
  end_date date,
  currency text not null default 'MYR',
  description text not null default '',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.trip_secrets (
  trip_id uuid primary key references public.trip_documents(id) on delete cascade,
  edit_password_hash text not null
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

alter table public.trip_documents enable row level security;
alter table public.trip_secrets enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "public can read trips" on public.trip_documents;
create policy "public can read trips" on public.trip_documents
for select using (true);

drop policy if exists "no direct trip writes" on public.trip_documents;
create policy "no direct trip writes" on public.trip_documents
for insert with check (false);

drop policy if exists "no direct trip updates" on public.trip_documents;
create policy "no direct trip updates" on public.trip_documents
for update using (false) with check (false);

drop policy if exists "no direct trip deletes" on public.trip_documents;
create policy "no direct trip deletes" on public.trip_documents
for delete using (false);

-- Secrets/settings are never directly readable by the public client.
drop policy if exists "no public secret select" on public.trip_secrets;
create policy "no public secret select" on public.trip_secrets
for select using (false);
drop policy if exists "no public secret writes" on public.trip_secrets;
create policy "no public secret writes" on public.trip_secrets
for all using (false) with check (false);

drop policy if exists "no public settings" on public.app_settings;
create policy "no public settings" on public.app_settings
for all using (false) with check (false);

-- Admin password: replace the value below before executing.
insert into public.app_settings(key, value)
values ('admin_password_hash', encode(digest('plannerAdmin@123', 'sha256'), 'hex'))
on conflict (key) do update set value = excluded.value;

create or replace function public._hash_password(p_password text)
returns text
language sql immutable security invoker
as $$ select encode(digest(coalesce(p_password,''), 'sha256'), 'hex'); $$;

create or replace function public.verify_trip_password(p_slug text, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_trip_id uuid;
  stored_hash text;
begin
  select id into v_trip_id from public.trip_documents where slug = p_slug;
  if v_trip_id is null then return false; end if;
  select s.edit_password_hash into stored_hash from public.trip_secrets s where s.trip_id = v_trip_id;
  return stored_hash = public._hash_password(p_password);
end;
$$;

create or replace function public.save_trip(p_slug text, p_password text, p_data jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_trip_id uuid;
  stored_hash text;
begin
  select id into v_trip_id from public.trip_documents where slug = p_slug;
  if v_trip_id is null then return false; end if;
  select edit_password_hash into stored_hash from public.trip_secrets where trip_id = v_trip_id;
  if stored_hash is distinct from public._hash_password(p_password) then return false; end if;
  update public.trip_documents set data = coalesce(p_data,'{}'::jsonb), updated_at = now() where id = v_trip_id;
  return true;
end;
$$;

create or replace function public.create_trip(
  p_admin_password text,
  p_slug text,
  p_title text,
  p_destination text,
  p_start_date date,
  p_end_date date,
  p_currency text,
  p_description text,
  p_edit_password text,
  p_data jsonb
)
returns public.trip_documents
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  admin_hash text;
  new_trip public.trip_documents;
begin
  select value into admin_hash from public.app_settings where key='admin_password_hash';
  if admin_hash is distinct from public._hash_password(p_admin_password) then
    raise exception 'Invalid admin password';
  end if;
  if length(trim(p_edit_password)) < 4 then raise exception 'Edit password must be at least 4 characters'; end if;
  insert into public.trip_documents(slug,title,destination,start_date,end_date,currency,description,data)
  values(lower(trim(p_slug)),trim(p_title),coalesce(trim(p_destination),''),p_start_date,p_end_date,coalesce(nullif(trim(p_currency),''),'MYR'),coalesce(p_description,''),coalesce(p_data,'{}'::jsonb))
  returning * into new_trip;
  insert into public.trip_secrets(trip_id, edit_password_hash) values(new_trip.id, public._hash_password(p_edit_password));
  return new_trip;
end;
$$;


create or replace function public.update_trip_meta(
  p_slug text, p_password text, p_title text, p_destination text,
  p_start_date date, p_end_date date, p_currency text, p_description text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_trip_id uuid; stored_hash text;
begin
  select id into v_trip_id from public.trip_documents where slug=p_slug;
  if v_trip_id is null then return false; end if;
  select edit_password_hash into stored_hash from public.trip_secrets where trip_id=v_trip_id;
  if stored_hash is distinct from public._hash_password(p_password) then return false; end if;
  update public.trip_documents
  set title=trim(p_title), destination=coalesce(trim(p_destination),''), start_date=p_start_date,
      end_date=p_end_date, currency=coalesce(nullif(trim(p_currency),''),'MYR'),
      description=coalesce(p_description,''), updated_at=now()
  where id=v_trip_id;
  return true;
end;
$$;

create or replace function public.change_trip_password(p_slug text, p_current_password text, p_new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_trip_id uuid;
  stored_hash text;
begin
  select id into v_trip_id from public.trip_documents where slug=p_slug;
  if v_trip_id is null then return false; end if;
  select edit_password_hash into stored_hash from public.trip_secrets where trip_id=v_trip_id;
  if stored_hash is distinct from public._hash_password(p_current_password) then return false; end if;
  if length(trim(p_new_password)) < 4 then return false; end if;
  update public.trip_secrets set edit_password_hash=public._hash_password(p_new_password) where trip_id=v_trip_id;
  return true;
end;
$$;

create or replace function public.delete_trip(p_admin_password text, p_slug text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare admin_hash text; did uuid;
begin
  select value into admin_hash from public.app_settings where key='admin_password_hash';
  if admin_hash is distinct from public._hash_password(p_admin_password) then return false; end if;
  select id into did from public.trip_documents where slug=p_slug;
  if did is null then return false; end if;
  delete from public.trip_documents where id=did;
  return true;
end;
$$;

revoke all on function public._hash_password(text) from public;
revoke all on function public.verify_trip_password(text,text) from public;
revoke all on function public.save_trip(text,text,jsonb) from public;
revoke all on function public.create_trip(text,text,text,text,date,date,text,text,text,jsonb) from public;
revoke all on function public.update_trip_meta(text,text,text,text,date,date,text,text) from public;
revoke all on function public.change_trip_password(text,text,text) from public;
revoke all on function public.delete_trip(text,text) from public;

grant execute on function public.verify_trip_password(text,text) to anon, authenticated;
grant execute on function public.save_trip(text,text,jsonb) to anon, authenticated;
grant execute on function public.create_trip(text,text,text,text,date,date,text,text,text,jsonb) to anon, authenticated;
grant execute on function public.update_trip_meta(text,text,text,text,date,date,text,text) to anon, authenticated;
grant execute on function public.change_trip_password(text,text,text) to anon, authenticated;
grant execute on function public.delete_trip(text,text) to anon, authenticated;

-- Enable Realtime for trip documents.
alter table public.trip_documents replica identity full;
do $$
begin
  alter publication supabase_realtime add table public.trip_documents;
exception when duplicate_object then null;
end $$;

-- Optional: one generic starter trip.
insert into public.trip_documents(slug,title,destination,currency,description,data)
values (
  'demo-trip', '我的旅行', '目的地待填写', 'MYR', '这是一个通用旅行模板。',
  '{"days":[{"n":1,"title":"Day 1","intensity":"light","steps":"","mapUrl":"","items":[],"notes":""}],"checklist":[],"hotels":[],"transport":[],"budget":[],"notes":[],"collapsed":{}}'::jsonb
)
on conflict (slug) do nothing;

insert into public.trip_secrets(trip_id, edit_password_hash)
select id, public._hash_password('demo1234')
from public.trip_documents where slug='demo-trip'
on conflict (trip_id) do nothing;
