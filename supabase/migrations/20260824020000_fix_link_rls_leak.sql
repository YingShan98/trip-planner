-- Fix RLS leak: activity_links and accommodation_links were left on their old
-- "readable if trips.visibility = 'public'" policies (or, for accommodation_links,
-- never migrated at all) while every sibling table was already switched to pure
-- trip_role() membership checks. Since trips.visibility defaults to 'public' and
-- create_trip always sets it to 'public', both tables were readable by anyone
-- holding the anon key via direct PostgREST calls, regardless of trip membership.

drop policy if exists "activity links read" on public.activity_links;
drop policy if exists "public activity links are readable" on public.activity_links;
create policy "activity links read" on public.activity_links for select using (exists (select 1 from public.activities a join public.trip_days d on d.id = a.day_id join public.trips t on t.id = d.trip_id where a.id = activity_id and public.trip_role(t.id) in ('owner', 'editor', 'viewer')));

drop policy if exists "public accommodation links are readable" on public.accommodation_links;
drop policy if exists "owners manage accommodation links" on public.accommodation_links;
drop policy if exists "accommodation links read" on public.accommodation_links;
drop policy if exists "accommodation links write" on public.accommodation_links;
create policy "accommodation links read" on public.accommodation_links for select using (exists (select 1 from public.accommodations a join public.trips t on t.id = a.trip_id where a.id = accommodation_id and public.trip_role(t.id) in ('owner', 'editor', 'viewer')));
create policy "accommodation links write" on public.accommodation_links for all using (exists (select 1 from public.accommodations a where a.id = accommodation_id and public.trip_role(a.trip_id) in ('owner', 'editor'))) with check (exists (select 1 from public.accommodations a where a.id = accommodation_id and public.trip_role(a.trip_id) in ('owner', 'editor')));
