-- DESTRUCTIVE: reset the entire Trip Planner database for a fresh v2 install.
-- Export any data you need first. Run schema-v2.sql and all v2 migrations afterwards.

begin;

-- Legacy v1 tables and functions.
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

-- v2 tables.
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
drop function if exists public.trip_role(uuid);
drop function if exists public.save_trip_workspace(uuid, jsonb);
drop function if exists public.create_trip_share(uuid, text, text, timestamptz);
drop function if exists public.revoke_trip_share(uuid);
drop function if exists public.revoke_trip_shares(uuid);
drop function if exists public.get_shared_trip_workspace(text);
drop function if exists public.set_updated_at();

commit;
