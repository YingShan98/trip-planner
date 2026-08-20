-- Trip Planner v2 normalized schema.
-- Run supabase/reset-v2.sql first only when you are ready to remove v2 data.
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
  visibility text not null default 'public' check (visibility in ('private', 'public', 'link')),
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

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_shares enable row level security;
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
