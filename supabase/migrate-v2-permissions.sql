-- Run once after schema-v2.sql to enable member-based access.
-- Owners retain full control; editors can modify trip content; viewers are read-only.

create or replace function public.trip_role(p_trip_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when t.owner_id = auth.uid() then 'owner'
    else coalesce((select tm.role from public.trip_members tm where tm.trip_id = p_trip_id and tm.user_id = auth.uid()), '')
  end
  from public.trips t
  where t.id = p_trip_id;
$$;

revoke all on function public.trip_role(uuid) from public;
grant execute on function public.trip_role(uuid) to anon, authenticated;

-- Trips: public trips can be viewed; members can view their private trips; owners update/delete.
drop policy if exists "public trips are readable" on public.trips;
drop policy if exists "owners manage trips" on public.trips;
create policy "trip visibility read" on public.trips
for select using (visibility = 'public' or owner_id = auth.uid() or public.trip_role(id) in ('owner', 'editor', 'viewer'));
create policy "trip owners manage" on public.trips
for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Memberships: only owners manage memberships; members can see their own membership.
drop policy if exists "members read memberships" on public.trip_members;
drop policy if exists "owners manage memberships" on public.trip_members;
create policy "members read memberships" on public.trip_members
for select using (user_id = auth.uid() or public.trip_role(trip_id) = 'owner');
create policy "owners manage memberships" on public.trip_members
for all using (public.trip_role(trip_id) = 'owner') with check (public.trip_role(trip_id) = 'owner');

-- Shares remain owner-managed until token RPCs are enabled.
drop policy if exists "owners read shares" on public.trip_shares;
drop policy if exists "owners manage shares" on public.trip_shares;
create policy "owners read shares" on public.trip_shares
for select using (public.trip_role(trip_id) = 'owner');
create policy "owners manage shares" on public.trip_shares
for all using (public.trip_role(trip_id) = 'owner') with check (public.trip_role(trip_id) = 'owner');

-- Replace child policies so editors can write and viewers can read member-only trips.
drop policy if exists "public days are readable" on public.trip_days;
drop policy if exists "owners manage days" on public.trip_days;
create policy "trip days read" on public.trip_days for select using (exists (select 1 from public.trips t where t.id = trip_id and (t.visibility = 'public' or public.trip_role(t.id) in ('owner', 'editor', 'viewer'))));
create policy "trip days write" on public.trip_days for all using (public.trip_role(trip_id) in ('owner', 'editor')) with check (public.trip_role(trip_id) in ('owner', 'editor'));

drop policy if exists "public activities are readable" on public.activities;
drop policy if exists "owners manage activities" on public.activities;
create policy "activities read" on public.activities for select using (exists (select 1 from public.trip_days d join public.trips t on t.id = d.trip_id where d.id = day_id and (t.visibility = 'public' or public.trip_role(t.id) in ('owner', 'editor', 'viewer'))));
create policy "activities write" on public.activities for all using (exists (select 1 from public.trip_days d where d.id = day_id and public.trip_role(d.trip_id) in ('owner', 'editor'))) with check (exists (select 1 from public.trip_days d where d.id = day_id and public.trip_role(d.trip_id) in ('owner', 'editor')));

drop policy if exists "public activity links are readable" on public.activity_links;
drop policy if exists "owners manage activity links" on public.activity_links;
create policy "activity links read" on public.activity_links for select using (exists (select 1 from public.activities a join public.trip_days d on d.id = a.day_id join public.trips t on t.id = d.trip_id where a.id = activity_id and (t.visibility = 'public' or public.trip_role(t.id) in ('owner', 'editor', 'viewer'))));
create policy "activity links write" on public.activity_links for all using (exists (select 1 from public.activities a join public.trip_days d on d.id = a.day_id where a.id = activity_id and public.trip_role(d.trip_id) in ('owner', 'editor'))) with check (exists (select 1 from public.activities a join public.trip_days d on d.id = a.day_id where a.id = activity_id and public.trip_role(d.trip_id) in ('owner', 'editor')));

-- The remaining trip-owned tables use the same member-aware rule.
do $$
declare table_name text; label text;
begin
  foreach table_name in array array['checklist_items','packing_items','accommodations','transport_options','budget_items','trip_notes'] loop
    label := replace(table_name, '_', ' ');
    execute format('drop policy if exists %I on public.%I', case table_name
      when 'checklist_items' then 'public checklist is readable'
      when 'packing_items' then 'public packing is readable'
      when 'accommodations' then 'public accommodations are readable'
      when 'transport_options' then 'public transport is readable'
      when 'budget_items' then 'public budget is readable'
      else 'public notes are readable' end, table_name);
    execute format('drop policy if exists %I on public.%I', 'owners manage ' || table_name, table_name);
    execute format('create policy %I on public.%I for select using (exists (select 1 from public.trips t where t.id = trip_id and (t.visibility = ''public'' or public.trip_role(t.id) in (''owner'', ''editor'', ''viewer''))))', label || ' read', table_name);
    execute format('create policy %I on public.%I for all using (public.trip_role(trip_id) in (''owner'', ''editor'')) with check (public.trip_role(trip_id) in (''owner'', ''editor''))', label || ' write', table_name);
  end loop;
end $$;
