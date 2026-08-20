-- DESTRUCTIVE: remove all v2 Trip Planner data and tables.
-- This does not touch the existing v1 tables such as trip_documents.
-- Run only when you are ready to start the normalized schema fresh.

begin;

drop table if exists public.activity_links cascade;
drop table if exists public.accommodation_links cascade;
drop table if exists public.activities cascade;
drop table if exists public.trip_days cascade;
drop table if exists public.checklist_items cascade;
drop table if exists public.packing_items cascade;
drop table if exists public.accommodations cascade;
drop table if exists public.transport_options cascade;
drop table if exists public.budget_items cascade;
drop table if exists public.trip_notes cascade;
drop table if exists public.trip_shares cascade;
drop table if exists public.trip_members cascade;
drop table if exists public.trips cascade;
drop table if exists public.profiles cascade;

drop function if exists public.set_updated_at();

commit;
