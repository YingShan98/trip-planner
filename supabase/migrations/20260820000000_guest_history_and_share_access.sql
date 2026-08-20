-- Upgrade an existing v2 database to the current share and collaboration schema.
-- This migration is intentionally non-destructive: it preserves all trip data.
-- The canonical schema is applied after removing policies that it recreates.

begin;

do $$
declare
  policy_name text;
  table_name text;
begin
  foreach table_name in array array[
    'trips', 'trip_members', 'trip_shares', 'trip_guest_identities',
    'trip_edit_events', 'trip_days', 'activities', 'activity_links',
    'checklist_items', 'packing_items', 'accommodations',
    'accommodation_links', 'transport_options', 'budget_items',
    'trip_notes', 'profiles'
  ] loop
    if to_regclass(format('public.%I', table_name)) is null then
      continue;
    end if;
    foreach policy_name in array array[
      'public trips are readable', 'owners manage trips',
      'trip visibility read', 'trip owners manage',
      'members read memberships', 'owners manage memberships',
      'owners read shares', 'owners manage shares',
      'guests manage own identity', 'owners read edit events',
      'public days are readable', 'owners manage days',
      'trip days read', 'trip days write',
      'public activities are readable', 'owners manage activities',
      'activities read', 'activities write',
      'public activity links are readable', 'owners manage activity links',
      'activity links read', 'activity links write',
      'public accommodation links are readable', 'owners manage accommodation links',
      'accommodation links read', 'accommodation links write',
      'public checklist is readable', 'owners manage checklist',
      'owners manage checklist_items',
      'checklist items read', 'checklist items write',
      'public packing is readable', 'owners manage packing',
      'owners manage packing_items',
      'packing items read', 'packing items write',
      'public accommodations are readable', 'owners manage accommodations',
      'accommodations read', 'accommodations write',
      'public transport is readable', 'owners manage transport',
      'owners manage transport_options',
      'transport options read', 'transport options write',
      'public budget is readable', 'owners manage budget',
      'owners manage budget_items',
      'budget items read', 'budget items write',
      'public notes are readable', 'owners manage notes',
      'owners manage trip_notes',
      'trip notes read', 'trip notes write',
      'users manage own profile'
    ] loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;
  end loop;
end $$;

\ir ../schema.sql

commit;
