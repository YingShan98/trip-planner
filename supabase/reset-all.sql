-- EXTREMELY DESTRUCTIVE: clear both the v1 and v2 Trip Planner schemas.
-- Do not run this while the current v1 React frontend is deployed.
-- Export/back up anything needed first. Run schema-v2.sql afterwards.

begin;

-- v1 tables and functions.
drop table if exists public.trip_documents cascade;
drop table if exists public.trip_secrets cascade;
drop table if exists public.app_settings cascade;
drop function if exists public.verify_trip_password(text, text);
drop function if exists public.save_trip(text, text, jsonb);
drop function if exists public.create_trip(text, text, text, text, date, date, text, text, text, jsonb);
drop function if exists public.create_trip(text, text, text, text, date, date, text, text, text, jsonb, boolean);
drop function if exists public.update_trip_meta(text, text, text, text, date, date, text, text);
drop function if exists public.change_trip_password(text, text, text);
drop function if exists public.set_trip_edit_requirement(text, text, boolean);
drop function if exists public.delete_trip(text, text);
drop function if exists public._hash_password(text);

-- v2 tables. Foreign keys make the order explicit and readable.
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
