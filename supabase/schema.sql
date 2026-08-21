-- Trip Planner normalized schema.
-- Run supabase/reset-fresh.sql first only when you are ready to wipe existing data.
-- This schema intentionally keeps owner_id nullable during the transition to Supabase Auth.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,80}$'),
  title text not null,
  destination text not null default '',
  description text not null default '',
  start_date date,
  end_date date,
  home_currency text not null default 'MYR',
  foreign_currency text not null default '',
  exchange_rate numeric,
  visibility text not null default 'public' check (visibility in ('private', 'public', 'link')),
  cover_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.trip_shares (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  token_hash text not null unique,
  permission text not null default 'view' check (permission in ('view', 'edit')),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_guest_identities (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.trip_edit_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text not null default '同行者',
  actor_type text not null check (actor_type in ('owner', 'member', 'guest')),
  share_id uuid references public.trip_shares(id) on delete set null,
  action text not null default 'update',
  section text not null default 'workspace',
  summary text not null default '更新了旅行计划',
  created_at timestamptz not null default now()
);

create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  title text not null default '',
  intensity text not null default 'light' check (intensity in ('light', 'medium', 'heavy')),
  walking_note text not null default '',
  map_url text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, day_number)
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references public.trip_days(id) on delete cascade,
  sort_order integer not null default 0,
  time_label text not null default '',
  title text not null default '',
  transport_note text not null default '',
  fee_note text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_links (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  label text not null default '',
  url text not null,
  sort_order integer not null default 0
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null default '其他',
  text text not null default '',
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null default '其他',
  text text not null default '',
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accommodations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  sort_order integer not null default 0,
  rank_label text not null default '',
  name text not null default '',
  address text not null default '',
  warning text not null default '',
  pros_cons text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accommodation_links (
  id uuid primary key default gen_random_uuid(),
  accommodation_id uuid not null references public.accommodations(id) on delete cascade,
  label text not null default '',
  url text not null,
  sort_order integer not null default 0
);

create table if not exists public.transport_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  sort_order integer not null default 0,
  type text not null default '',
  description text not null default '',
  price_label text not null default '',
  amount numeric,
  currency_code text not null default 'MYR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  sort_order integer not null default 0,
  category text not null default '',
  unit text not null default '',
  quantity numeric not null default 1,
  unit_price numeric not null default 0,
  currency_code text not null default 'MYR',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text not null default '',
  content text not null default '',
  -- Optional: ties this note to one hotel/day card instead of the general notes wall.
  -- target_index refers to that item's position in TripState.hotels/days at save time (see CLAUDE.md mutation pattern) — not a foreign key.
  target_type text check (target_type in ('hotel', 'day')),
  target_index integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_days_trip_order_idx on public.trip_days(trip_id, day_number);
create index if not exists activities_day_order_idx on public.activities(day_id, sort_order);
create index if not exists checklist_trip_order_idx on public.checklist_items(trip_id, sort_order);
create index if not exists packing_trip_order_idx on public.packing_items(trip_id, sort_order);
create index if not exists accommodations_trip_order_idx on public.accommodations(trip_id, sort_order);
create index if not exists transport_trip_order_idx on public.transport_options(trip_id, sort_order);
create index if not exists budget_trip_order_idx on public.budget_items(trip_id, sort_order);
create index if not exists notes_trip_created_idx on public.trip_notes(trip_id, created_at desc);
create index if not exists edit_events_trip_created_idx on public.trip_edit_events(trip_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_shares enable row level security;
alter table public.trip_guest_identities enable row level security;
alter table public.trip_edit_events enable row level security;
alter table public.trip_days enable row level security;
alter table public.activities enable row level security;
alter table public.activity_links enable row level security;
alter table public.checklist_items enable row level security;
alter table public.packing_items enable row level security;
alter table public.accommodations enable row level security;
alter table public.accommodation_links enable row level security;
alter table public.transport_options enable row level security;
alter table public.budget_items enable row level security;
alter table public.trip_notes enable row level security;

-- Public trips are readable for the current anonymous viewer experience.
-- Private/link-only access will be enforced by share-token RPCs in the next frontend phase.
create policy "public trips are readable" on public.trips for select using (visibility = 'public' or owner_id = auth.uid());
create policy "owners manage trips" on public.trips for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "members read memberships" on public.trip_members for select using (user_id = auth.uid() or exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "owners manage memberships" on public.trip_members for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "owners read shares" on public.trip_shares for select using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "owners manage shares" on public.trip_shares for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "guests manage own identity" on public.trip_guest_identities for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owners read edit events" on public.trip_edit_events for select using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

-- Child rows are readable when their trip is public or owned by the current user.
create policy "public days are readable" on public.trip_days for select using (exists (select 1 from public.trips t where t.id = trip_id and (t.visibility = 'public' or t.owner_id = auth.uid())));
create policy "owners manage days" on public.trip_days for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "public checklist is readable" on public.checklist_items for select using (exists (select 1 from public.trips t where t.id = trip_id and (t.visibility = 'public' or t.owner_id = auth.uid())));
create policy "owners manage checklist" on public.checklist_items for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "public packing is readable" on public.packing_items for select using (exists (select 1 from public.trips t where t.id = trip_id and (t.visibility = 'public' or t.owner_id = auth.uid())));
create policy "owners manage packing" on public.packing_items for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "public accommodations are readable" on public.accommodations for select using (exists (select 1 from public.trips t where t.id = trip_id and (t.visibility = 'public' or t.owner_id = auth.uid())));
create policy "owners manage accommodations" on public.accommodations for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "public transport is readable" on public.transport_options for select using (exists (select 1 from public.trips t where t.id = trip_id and (t.visibility = 'public' or t.owner_id = auth.uid())));
create policy "owners manage transport" on public.transport_options for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "public budget is readable" on public.budget_items for select using (exists (select 1 from public.trips t where t.id = trip_id and (t.visibility = 'public' or t.owner_id = auth.uid())));
create policy "owners manage budget" on public.budget_items for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));
create policy "public notes are readable" on public.trip_notes for select using (exists (select 1 from public.trips t where t.id = trip_id and (t.visibility = 'public' or t.owner_id = auth.uid())));
create policy "owners manage notes" on public.trip_notes for all using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

create policy "public activities are readable" on public.activities for select using (exists (select 1 from public.trip_days d join public.trips t on t.id = d.trip_id where d.id = day_id and (t.visibility = 'public' or t.owner_id = auth.uid())));
create policy "owners manage activities" on public.activities for all using (exists (select 1 from public.trip_days d join public.trips t on t.id = d.trip_id where d.id = day_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.trip_days d join public.trips t on t.id = d.trip_id where d.id = day_id and t.owner_id = auth.uid()));
create policy "public activity links are readable" on public.activity_links for select using (exists (select 1 from public.activities a join public.trip_days d on d.id = a.day_id join public.trips t on t.id = d.trip_id where a.id = activity_id and (t.visibility = 'public' or t.owner_id = auth.uid())));
create policy "owners manage activity links" on public.activity_links for all using (exists (select 1 from public.activities a join public.trip_days d on d.id = a.day_id join public.trips t on t.id = d.trip_id where a.id = activity_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.activities a join public.trip_days d on d.id = a.day_id join public.trips t on t.id = d.trip_id where a.id = activity_id and t.owner_id = auth.uid()));
create policy "public accommodation links are readable" on public.accommodation_links for select using (exists (select 1 from public.accommodations a join public.trips t on t.id = a.trip_id where a.id = accommodation_id and (t.visibility = 'public' or t.owner_id = auth.uid())));
create policy "owners manage accommodation links" on public.accommodation_links for all using (exists (select 1 from public.accommodations a join public.trips t on t.id = a.trip_id where a.id = accommodation_id and t.owner_id = auth.uid())) with check (exists (select 1 from public.accommodations a join public.trips t on t.id = a.trip_id where a.id = accommodation_id and t.owner_id = auth.uid()));

create policy "users manage own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

-- Updated-at helper for mutable rows.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
  create trigger trips_updated_at before update on public.trips for each row execute function public.set_updated_at();
  create trigger trip_days_updated_at before update on public.trip_days for each row execute function public.set_updated_at();
  create trigger activities_updated_at before update on public.activities for each row execute function public.set_updated_at();
  create trigger checklist_updated_at before update on public.checklist_items for each row execute function public.set_updated_at();
  create trigger packing_updated_at before update on public.packing_items for each row execute function public.set_updated_at();
  create trigger accommodations_updated_at before update on public.accommodations for each row execute function public.set_updated_at();
  create trigger transport_updated_at before update on public.transport_options for each row execute function public.set_updated_at();
  create trigger budget_updated_at before update on public.budget_items for each row execute function public.set_updated_at();
  create trigger notes_updated_at before update on public.trip_notes for each row execute function public.set_updated_at();
exception when duplicate_object then null;
end $$;

-- Fresh-install compatibility: these statements also upgrade an older v2 database.
alter table public.trips
  add column if not exists foreign_currency text not null default '',
  add column if not exists exchange_rate numeric,
  add column if not exists edit_password_hash text,
  add column if not exists cover_image_url text;

alter table public.trip_notes
  add column if not exists target_type text check (target_type in ('hotel', 'day')),
  add column if not exists target_index integer;

alter table public.checklist_items
  add column if not exists category text not null default '其他';

-- Role helper used by RLS and transactional RPCs.
create or replace function public.trip_role(p_trip_id uuid)
returns text language sql stable security definer set search_path = public
as $$
  select case
    when t.owner_id = auth.uid() then 'owner'
    else coalesce((select tm.role from public.trip_members tm where tm.trip_id = p_trip_id and tm.user_id = auth.uid()), '')
  end
  from public.trips t where t.id = p_trip_id;
$$;

revoke all on function public.trip_role(uuid) from public;
grant execute on function public.trip_role(uuid) to anon, authenticated;

drop policy if exists "public trips are readable" on public.trips;
drop policy if exists "owners manage trips" on public.trips;
create policy "trip visibility read" on public.trips for select using (owner_id = auth.uid() or public.trip_role(id) in ('owner', 'editor', 'viewer'));
create policy "trip owners manage" on public.trips for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "members read memberships" on public.trip_members;
drop policy if exists "owners manage memberships" on public.trip_members;
create policy "members read memberships" on public.trip_members for select using (user_id = auth.uid() or public.trip_role(trip_id) = 'owner');
create policy "owners manage memberships" on public.trip_members for all using (public.trip_role(trip_id) = 'owner') with check (public.trip_role(trip_id) = 'owner');

drop policy if exists "owners read shares" on public.trip_shares;
drop policy if exists "owners manage shares" on public.trip_shares;
create policy "owners read shares" on public.trip_shares for select using (public.trip_role(trip_id) = 'owner');
create policy "owners manage shares" on public.trip_shares for all using (public.trip_role(trip_id) = 'owner') with check (public.trip_role(trip_id) = 'owner');

drop policy if exists "public days are readable" on public.trip_days;
drop policy if exists "owners manage days" on public.trip_days;
create policy "trip days read" on public.trip_days for select using (exists (select 1 from public.trips t where t.id = trip_id and public.trip_role(t.id) in ('owner', 'editor', 'viewer')));
create policy "trip days write" on public.trip_days for all using (public.trip_role(trip_id) in ('owner', 'editor')) with check (public.trip_role(trip_id) in ('owner', 'editor'));

drop policy if exists "public activities are readable" on public.activities;
drop policy if exists "owners manage activities" on public.activities;
create policy "activities read" on public.activities for select using (exists (select 1 from public.trip_days d join public.trips t on t.id = d.trip_id where d.id = day_id and public.trip_role(t.id) in ('owner', 'editor', 'viewer')));
create policy "activities write" on public.activities for all using (exists (select 1 from public.trip_days d where d.id = day_id and public.trip_role(d.trip_id) in ('owner', 'editor'))) with check (exists (select 1 from public.trip_days d where d.id = day_id and public.trip_role(d.trip_id) in ('owner', 'editor')));

drop policy if exists "public activity links are readable" on public.activity_links;
drop policy if exists "owners manage activity links" on public.activity_links;
create policy "activity links read" on public.activity_links for select using (exists (select 1 from public.activities a join public.trip_days d on d.id = a.day_id join public.trips t on t.id = d.trip_id where a.id = activity_id and (t.visibility = 'public' or public.trip_role(t.id) in ('owner', 'editor', 'viewer'))));
create policy "activity links write" on public.activity_links for all using (exists (select 1 from public.activities a join public.trip_days d on d.id = a.day_id where a.id = activity_id and public.trip_role(d.trip_id) in ('owner', 'editor'))) with check (exists (select 1 from public.activities a join public.trip_days d on d.id = a.day_id where a.id = activity_id and public.trip_role(d.trip_id) in ('owner', 'editor')));

do $$
declare table_name text; label text; readable_policy text;
begin
  foreach table_name in array array['checklist_items','packing_items','accommodations','transport_options','budget_items','trip_notes'] loop
    label := replace(table_name, '_', ' ');
    readable_policy := case table_name
      when 'checklist_items' then 'public checklist is readable'
      when 'packing_items' then 'public packing is readable'
      when 'accommodations' then 'public accommodations are readable'
      when 'transport_options' then 'public transport is readable'
      when 'budget_items' then 'public budget is readable'
      else 'public notes are readable' end;
    execute format('drop policy if exists %I on public.%I', readable_policy, table_name);
    execute format('drop policy if exists %I on public.%I', 'owners manage ' || table_name, table_name);
    execute format('create policy %I on public.%I for select using (exists (select 1 from public.trips t where t.id = trip_id and public.trip_role(t.id) in (''owner'', ''editor'', ''viewer'')))', label || ' read', table_name);
    execute format('create policy %I on public.%I for all using (public.trip_role(trip_id) in (''owner'', ''editor'')) with check (public.trip_role(trip_id) in (''owner'', ''editor''))', label || ' write', table_name);
  end loop;
end $$;

-- Save the compatibility state in one transaction.
drop function if exists public.save_trip_workspace(uuid, jsonb);
drop function if exists public.save_trip_workspace(uuid, jsonb, text);
drop function if exists public.save_trip_workspace(uuid, jsonb, text, text);
create or replace function public.save_trip_workspace(p_trip_id uuid, p_state jsonb, p_token_hash text default null, p_password text default null)
returns boolean language plpgsql security definer set search_path = public, extensions
as $$
declare v_role text; v_day jsonb; v_activity jsonb; v_link jsonb; v_hotel jsonb; v_index integer; v_day_id uuid; v_activity_id uuid; v_hotel_id uuid; v_home_currency text; v_foreign_currency text; v_edit_password_hash text;
begin
  v_role := public.trip_role(p_trip_id);
  if v_role not in ('owner', 'editor') and exists (select 1 from public.trip_shares where trip_id = p_trip_id and token_hash = p_token_hash and permission = 'edit' and revoked_at is null and (expires_at is null or expires_at > now())) then
    select edit_password_hash into v_edit_password_hash from public.trips where id = p_trip_id;
    if v_edit_password_hash is not null and (p_password is null or crypt(p_password, v_edit_password_hash) <> v_edit_password_hash) then return false; end if;
    v_role := 'editor';
  end if;
  if v_role not in ('owner', 'editor') or p_state is null or jsonb_typeof(p_state) <> 'object' then return false; end if;
  v_home_currency := coalesce((select home_currency from public.trips where id = p_trip_id), 'MYR');
  v_foreign_currency := coalesce(nullif(p_state->>'foreignCurrency', ''), 'CNY');
  update public.trips set foreign_currency = v_foreign_currency, exchange_rate = nullif(p_state->>'exchangeRate', '')::numeric, updated_at = now() where id = p_trip_id;
  delete from public.checklist_items where trip_id = p_trip_id;
  delete from public.packing_items where trip_id = p_trip_id;
  delete from public.accommodations where trip_id = p_trip_id;
  delete from public.transport_options where trip_id = p_trip_id;
  delete from public.budget_items where trip_id = p_trip_id;
  delete from public.trip_notes where trip_id = p_trip_id;
  delete from public.trip_days where trip_id = p_trip_id;
  insert into public.checklist_items(trip_id, category, text, is_done, sort_order) select p_trip_id, coalesce(item->>'category','其他'), coalesce(item->>'text',''), coalesce((item->>'done')::boolean, false), ordinality - 1 from jsonb_array_elements(coalesce(p_state->'checklist','[]'::jsonb)) with ordinality as rows(item, ordinality);
  insert into public.packing_items(trip_id, category, text, is_done, sort_order) select p_trip_id, coalesce(item->>'category','其他'), coalesce(item->>'text',''), coalesce((item->>'done')::boolean, false), ordinality - 1 from jsonb_array_elements(coalesce(p_state->'packing','[]'::jsonb)) with ordinality as rows(item, ordinality);
  insert into public.transport_options(trip_id, sort_order, type, description, price_label, amount, currency_code) select p_trip_id, ordinality - 1, coalesce(item->>'type',''), coalesce(item->>'description',''), coalesce(item->>'price',''), nullif(item->>'amount','')::numeric, case when item->>'currency' = 'foreign' then v_foreign_currency else v_home_currency end from jsonb_array_elements(coalesce(p_state->'transport','[]'::jsonb)) with ordinality as rows(item, ordinality);
  insert into public.budget_items(trip_id, sort_order, category, unit, quantity, unit_price, currency_code, note) select p_trip_id, ordinality - 1, coalesce(item->>'category',''), coalesce(item->>'unit',''), coalesce(nullif(item->>'quantity','')::numeric, 0), coalesce(nullif(item->>'unitPrice','')::numeric, 0), case when item->>'currency' = 'foreign' then v_foreign_currency else v_home_currency end, coalesce(item->>'note','') from jsonb_array_elements(coalesce(p_state->'budget','[]'::jsonb)) with ordinality as rows(item, ordinality);
  insert into public.trip_notes(trip_id, author_name, content, target_type, target_index)
  select p_trip_id, coalesce(item->>'author',''), coalesce(item->>'text',''), item->'target'->>'type', nullif(item->'target'->>'index','')::integer
  from jsonb_array_elements(coalesce(p_state->'notes','[]'::jsonb)) as rows(item);
  v_index := 0;
  for v_day in select value from jsonb_array_elements(coalesce(p_state->'days','[]'::jsonb)) loop
    insert into public.trip_days(trip_id, day_number, title, intensity, walking_note, map_url, notes) values (p_trip_id, v_index + 1, coalesce(v_day->>'title','Day ' || (v_index + 1)), coalesce(v_day->>'intensity','light'), coalesce(v_day->>'steps',''), coalesce(v_day->>'mapUrl',''), coalesce(v_day->>'notes','')) returning id into v_day_id;
    for v_activity in select value from jsonb_array_elements(coalesce(v_day->'items','[]'::jsonb)) loop
      insert into public.activities(day_id, sort_order, time_label, title, transport_note, fee_note) values (v_day_id, v_index, coalesce(v_activity->>'t',''), coalesce(v_activity->>'x',''), coalesce(v_activity->>'move',''), coalesce(v_activity->>'fee','')) returning id into v_activity_id;
      v_index := v_index + 1;
      for v_link in select value from jsonb_array_elements(coalesce(v_activity->'link','[]'::jsonb)) loop
        if nullif(trim(v_link->>'url'), '') is not null then insert into public.activity_links(activity_id, label, url, sort_order) values (v_activity_id, coalesce(nullif(v_link->>'label',''), v_link->>'url'), v_link->>'url', 0); end if;
      end loop;
    end loop;
    v_index := v_index + 1;
  end loop;
  v_index := 0;
  for v_hotel in select value from jsonb_array_elements(coalesce(p_state->'hotels','[]'::jsonb)) loop
    insert into public.accommodations(trip_id, sort_order, rank_label, name, address, warning, pros_cons, notes) values (p_trip_id, v_index, coalesce(v_hotel->>'rank',''), coalesce(v_hotel->>'name',''), coalesce(v_hotel->>'addr',''), coalesce(v_hotel->>'warn',''), coalesce(v_hotel->>'pointsText',''), coalesce(v_hotel->>'notes','')) returning id into v_hotel_id;
    for v_link in select value from jsonb_array_elements(coalesce(v_hotel->'link','[]'::jsonb)) loop
      if nullif(trim(v_link->>'url'), '') is not null then insert into public.accommodation_links(accommodation_id, label, url, sort_order) values (v_hotel_id, coalesce(nullif(v_link->>'label',''), v_link->>'url'), v_link->>'url', 0); end if;
    end loop;
    v_index := v_index + 1;
  end loop;
  insert into public.trip_edit_events(trip_id, actor_id, actor_name, actor_type, share_id, summary)
  values (
    p_trip_id,
    auth.uid(),
    coalesce(nullif((select gi.display_name from public.trip_guest_identities gi where gi.trip_id = p_trip_id and gi.user_id = auth.uid()), ''), nullif((select p.display_name from public.profiles p where p.id = auth.uid()), ''), case when public.trip_role(p_trip_id) = 'owner' then '旅行拥有者' else '同行者' end),
    case when public.trip_role(p_trip_id) = 'owner' then 'owner' when public.trip_role(p_trip_id) in ('editor', 'viewer') then 'member' else 'guest' end,
    (select s.id from public.trip_shares s where s.trip_id = p_trip_id and s.token_hash = p_token_hash and s.revoked_at is null limit 1),
    '更新了旅行计划'
  );
  return true;
end;
$$;
revoke all on function public.save_trip_workspace(uuid, jsonb, text, text) from public;
grant execute on function public.save_trip_workspace(uuid, jsonb, text, text) to anon, authenticated;

create or replace function public.set_trip_guest_name(p_trip_id uuid, p_token_hash text, p_display_name text)
returns boolean language plpgsql security definer set search_path = public, extensions
as $$
begin
  if auth.uid() is null or nullif(trim(p_display_name), '') is null or char_length(trim(p_display_name)) > 80 then return false; end if;
  if not exists (select 1 from public.trip_shares where trip_id = p_trip_id and token_hash = p_token_hash and permission = 'edit' and revoked_at is null and (expires_at is null or expires_at > now())) then return false; end if;
  insert into public.trip_guest_identities(trip_id, user_id, display_name) values (p_trip_id, auth.uid(), trim(p_display_name))
  on conflict (trip_id, user_id) do update set display_name = excluded.display_name, updated_at = now();
  return true;
end; $$;

create or replace function public.get_trip_edit_events(p_trip_id uuid)
returns table(id uuid, actor_name text, actor_type text, action text, section text, summary text, created_at timestamptz)
language sql security definer set search_path = public, extensions
as $$
  select e.id, e.actor_name, e.actor_type, e.action, e.section, e.summary, e.created_at
  from public.trip_edit_events e join public.trips t on t.id = e.trip_id
  where e.trip_id = p_trip_id and t.owner_id = auth.uid()
  order by e.created_at desc limit 100;
$$;

revoke all on function public.set_trip_guest_name(uuid, text, text) from public;
grant execute on function public.set_trip_guest_name(uuid, text, text) to anon, authenticated;
revoke all on function public.get_trip_edit_events(uuid) from public;
grant execute on function public.get_trip_edit_events(uuid) to authenticated;

-- Optional owner-set password gating edit-permission share links, on top of the token itself.
create or replace function public.set_trip_edit_password(p_trip_id uuid, p_password text)
returns boolean language plpgsql security definer set search_path = public, extensions
as $$
begin
  if public.trip_role(p_trip_id) <> 'owner' then return false; end if;
  if p_password is null or trim(p_password) = '' then
    update public.trips set edit_password_hash = null where id = p_trip_id;
  else
    if char_length(trim(p_password)) < 4 then return false; end if;
    update public.trips set edit_password_hash = crypt(trim(p_password), gen_salt('bf')) where id = p_trip_id;
  end if;
  return true;
end; $$;

create or replace function public.verify_trip_edit_password(p_token_hash text, p_password text)
returns boolean language plpgsql security definer set search_path = public, extensions
as $$
declare v_trip_id uuid; v_hash text;
begin
  select trip_id into v_trip_id from public.trip_shares where token_hash = p_token_hash and permission = 'edit' and revoked_at is null and (expires_at is null or expires_at > now()) limit 1;
  if v_trip_id is null then return false; end if;
  select edit_password_hash into v_hash from public.trips where id = v_trip_id;
  if v_hash is null then return true; end if;
  return v_hash = crypt(coalesce(p_password, ''), v_hash);
end; $$;

revoke all on function public.set_trip_edit_password(uuid, text) from public;
grant execute on function public.set_trip_edit_password(uuid, text) to authenticated;
revoke all on function public.verify_trip_edit_password(text, text) from public;
grant execute on function public.verify_trip_edit_password(text, text) to anon, authenticated;

-- Secure, hashed, revocable, expiring read-only share links.
create or replace function public.create_trip_share(p_trip_id uuid, p_token_hash text, p_permission text default 'view', p_expires_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public, extensions
as $$ declare v_id uuid; begin
  if public.trip_role(p_trip_id) <> 'owner' or p_permission not in ('view', 'edit') then return null; end if;
  insert into public.trip_shares(trip_id, token_hash, permission, expires_at, created_by) values (p_trip_id, p_token_hash, p_permission, p_expires_at, auth.uid()) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.revoke_trip_share(p_share_id uuid)
returns boolean language plpgsql security definer set search_path = public, extensions
as $$ begin update public.trip_shares s set revoked_at = now() where s.id = p_share_id and public.trip_role(s.trip_id) = 'owner' and s.revoked_at is null; return found; end; $$;

create or replace function public.revoke_trip_shares(p_trip_id uuid)
returns integer language plpgsql security definer set search_path = public, extensions
as $$ declare v_count integer; begin
  if public.trip_role(p_trip_id) <> 'owner' then return 0; end if;
  update public.trip_shares set revoked_at = now() where trip_id = p_trip_id and revoked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

create or replace function public.get_shared_trip_workspace(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = public, extensions
as $$
declare v_trip_id uuid; v_trip jsonb; v_state jsonb; v_requires_password boolean;
begin
  select trip_id into v_trip_id from public.trip_shares where token_hash = p_token_hash and revoked_at is null and (expires_at is null or expires_at > now()) limit 1;
  if v_trip_id is null then return null; end if;
  select (edit_password_hash is not null) into v_requires_password from public.trips where id = v_trip_id;
  select jsonb_build_object('id', t.id, 'slug', t.slug, 'title', t.title, 'destination', t.destination, 'description', t.description, 'start_date', t.start_date, 'end_date', t.end_date, 'home_currency', t.home_currency, 'foreign_currency', t.foreign_currency, 'exchange_rate', t.exchange_rate, 'visibility', t.visibility, 'owner_id', t.owner_id, 'cover_image_url', t.cover_image_url, 'created_at', t.created_at, 'updated_at', t.updated_at) into v_trip from public.trips t where t.id = v_trip_id;
  select jsonb_build_object(
    'days', coalesce((select jsonb_agg(jsonb_build_object('n', d.day_number, 'title', d.title, 'intensity', d.intensity, 'steps', d.walking_note, 'mapUrl', d.map_url, 'notes', d.notes, 'items', coalesce((select jsonb_agg(jsonb_build_object('t', a.time_label, 'x', a.title, 'move', a.transport_note, 'fee', a.fee_note, 'link', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url) order by l.sort_order) from public.activity_links l where l.activity_id = a.id), '[]'::jsonb)) order by a.sort_order) from public.activities a where a.day_id = d.id), '[]'::jsonb)) order by d.day_number) from public.trip_days d where d.trip_id = v_trip_id), '[]'::jsonb),
    'checklist', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'text', c.text, 'done', c.is_done, 'category', c.category) order by c.sort_order) from public.checklist_items c where c.trip_id = v_trip_id), '[]'::jsonb),
    'packing', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'text', p.text, 'done', p.is_done, 'category', p.category) order by p.sort_order) from public.packing_items p where p.trip_id = v_trip_id), '[]'::jsonb),
    'hotels', coalesce((select jsonb_agg(jsonb_build_object('rank', h.rank_label, 'name', h.name, 'addr', h.address, 'warn', h.warning, 'pointsText', h.pros_cons, 'notes', h.notes, 'link', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url) order by l.sort_order) from public.accommodation_links l where l.accommodation_id = h.id), '[]'::jsonb)) order by h.sort_order) from public.accommodations h where h.trip_id = v_trip_id), '[]'::jsonb),
    'transport', coalesce((select jsonb_agg(jsonb_build_object('type', x.type, 'description', x.description, 'price', x.price_label, 'amount', x.amount, 'currency', case when x.currency_code = t.home_currency then 'home' else 'foreign' end) order by x.sort_order) from public.transport_options x join public.trips t on t.id = x.trip_id where x.trip_id = v_trip_id), '[]'::jsonb),
    'budget', coalesce((select jsonb_agg(jsonb_build_object('category', b.category, 'unit', b.unit, 'quantity', b.quantity, 'unitPrice', b.unit_price, 'currency', case when b.currency_code = t.home_currency then 'home' else 'foreign' end, 'note', b.note) order by b.sort_order) from public.budget_items b join public.trips t on t.id = b.trip_id where b.trip_id = v_trip_id), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('author', n.author_name, 'text', n.content, 'ts', n.created_at, 'target', case when n.target_type is not null then jsonb_build_object('type', n.target_type, 'index', n.target_index) else null end) order by n.created_at desc) from public.trip_notes n where n.trip_id = v_trip_id), '[]'::jsonb),
    'collapsed', '{}'::jsonb, 'foreignCurrency', v_trip->>'foreign_currency', 'exchangeRate', v_trip->>'exchange_rate'
  ) into v_state;
  return jsonb_build_object('trip', v_trip, 'state', v_state, 'sharePermission', (select permission from public.trip_shares where token_hash = p_token_hash and trip_id = v_trip_id and revoked_at is null and (expires_at is null or expires_at > now()) limit 1), 'requiresEditPassword', coalesce(v_requires_password, false));
end; $$;

revoke all on function public.create_trip_share(uuid, text, text, timestamptz) from public;
revoke all on function public.revoke_trip_share(uuid) from public;
revoke all on function public.revoke_trip_shares(uuid) from public;
revoke all on function public.get_shared_trip_workspace(text) from public;
grant execute on function public.create_trip_share(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.revoke_trip_share(uuid) to authenticated;
grant execute on function public.revoke_trip_shares(uuid) to authenticated;
grant execute on function public.get_shared_trip_workspace(text) to anon, authenticated;

alter table public.trips replica identity full;
alter table public.trip_days replica identity full;
alter table public.activities replica identity full;
alter table public.checklist_items replica identity full;
alter table public.packing_items replica identity full;
alter table public.accommodations replica identity full;
alter table public.transport_options replica identity full;
alter table public.budget_items replica identity full;
alter table public.trip_notes replica identity full;

-- Add the v2 tables to Realtime. Duplicate publication entries are harmlessly ignored.
do $$
begin
  alter publication supabase_realtime add table public.trips;
  alter publication supabase_realtime add table public.trip_days;
  alter publication supabase_realtime add table public.activities;
  alter publication supabase_realtime add table public.checklist_items;
  alter publication supabase_realtime add table public.packing_items;
  alter publication supabase_realtime add table public.accommodations;
  alter publication supabase_realtime add table public.transport_options;
  alter publication supabase_realtime add table public.budget_items;
  alter publication supabase_realtime add table public.trip_notes;
exception when duplicate_object then null;
end $$;
