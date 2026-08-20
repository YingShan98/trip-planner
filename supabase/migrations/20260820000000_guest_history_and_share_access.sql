-- Upgrade an existing v2 database to the current share and collaboration schema.
-- This migration is intentionally non-destructive: it preserves all trip data.
-- The canonical schema is applied after removing policies that it recreates.

begin;

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

create index if not exists edit_events_trip_created_idx on public.trip_edit_events(trip_id, created_at desc);
alter table public.trip_guest_identities enable row level security;
alter table public.trip_edit_events enable row level security;

drop policy if exists "guests manage own identity" on public.trip_guest_identities;
create policy "guests manage own identity" on public.trip_guest_identities for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "owners read edit events" on public.trip_edit_events;
create policy "owners read edit events" on public.trip_edit_events for select using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

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
drop policy if exists "trip visibility read" on public.trips;
drop policy if exists "trip owners manage" on public.trips;
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
drop policy if exists "trip days read" on public.trip_days;
drop policy if exists "trip days write" on public.trip_days;
create policy "trip days read" on public.trip_days for select using (exists (select 1 from public.trips t where t.id = trip_id and public.trip_role(t.id) in ('owner', 'editor', 'viewer')));
create policy "trip days write" on public.trip_days for all using (public.trip_role(trip_id) in ('owner', 'editor')) with check (public.trip_role(trip_id) in ('owner', 'editor'));

drop policy if exists "public activities are readable" on public.activities;
drop policy if exists "owners manage activities" on public.activities;
drop policy if exists "activities read" on public.activities;
drop policy if exists "activities write" on public.activities;
create policy "activities read" on public.activities for select using (exists (select 1 from public.trip_days d join public.trips t on t.id = d.trip_id where d.id = day_id and public.trip_role(t.id) in ('owner', 'editor', 'viewer')));
create policy "activities write" on public.activities for all using (exists (select 1 from public.trip_days d where d.id = day_id and public.trip_role(d.trip_id) in ('owner', 'editor'))) with check (exists (select 1 from public.trip_days d where d.id = day_id and public.trip_role(d.trip_id) in ('owner', 'editor')));

drop policy if exists "public activity links are readable" on public.activity_links;
drop policy if exists "owners manage activity links" on public.activity_links;
drop policy if exists "activity links read" on public.activity_links;
drop policy if exists "activity links write" on public.activity_links;
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
    execute format('drop policy if exists %I on public.%I', label || ' read', table_name);
    execute format('drop policy if exists %I on public.%I', label || ' write', table_name);
    execute format('create policy %I on public.%I for select using (exists (select 1 from public.trips t where t.id = trip_id and public.trip_role(t.id) in (''owner'', ''editor'', ''viewer'')))', label || ' read', table_name);
    execute format('create policy %I on public.%I for all using (public.trip_role(trip_id) in (''owner'', ''editor'')) with check (public.trip_role(trip_id) in (''owner'', ''editor''))', label || ' write', table_name);
  end loop;
end $$;

drop function if exists public.save_trip_workspace(uuid, jsonb);
drop function if exists public.save_trip_workspace(uuid, jsonb, text);
drop function if exists public.save_trip_workspace(uuid, jsonb, text, text);
create or replace function public.save_trip_workspace(p_trip_id uuid, p_state jsonb, p_token_hash text default null)
returns boolean language plpgsql security definer set search_path = public, extensions
as $$
declare v_role text; v_day jsonb; v_activity jsonb; v_link jsonb; v_hotel jsonb; v_index integer; v_day_id uuid; v_activity_id uuid; v_hotel_id uuid; v_home_currency text; v_foreign_currency text;
begin
  v_role := public.trip_role(p_trip_id);
  if v_role not in ('owner', 'editor') and exists (select 1 from public.trip_shares where trip_id = p_trip_id and token_hash = p_token_hash and permission = 'edit' and revoked_at is null and (expires_at is null or expires_at > now())) then v_role := 'editor'; end if;
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
  insert into public.checklist_items(trip_id, text, is_done, sort_order) select p_trip_id, coalesce(item->>'text',''), coalesce((item->>'done')::boolean, false), ordinality - 1 from jsonb_array_elements(coalesce(p_state->'checklist','[]'::jsonb)) with ordinality as rows(item, ordinality);
  insert into public.packing_items(trip_id, category, text, is_done, sort_order) select p_trip_id, coalesce(item->>'category','其他'), coalesce(item->>'text',''), coalesce((item->>'done')::boolean, false), ordinality - 1 from jsonb_array_elements(coalesce(p_state->'packing','[]'::jsonb)) with ordinality as rows(item, ordinality);
  insert into public.transport_options(trip_id, sort_order, type, description, price_label, amount, currency_code) select p_trip_id, ordinality - 1, coalesce(item->>'type',''), coalesce(item->>'description',''), coalesce(item->>'price',''), nullif(item->>'amount','')::numeric, case when item->>'currency' = 'foreign' then v_foreign_currency else v_home_currency end from jsonb_array_elements(coalesce(p_state->'transport','[]'::jsonb)) with ordinality as rows(item, ordinality);
  insert into public.budget_items(trip_id, sort_order, category, unit, quantity, unit_price, currency_code, note) select p_trip_id, ordinality - 1, coalesce(item->>'category',''), coalesce(item->>'unit',''), coalesce(nullif(item->>'quantity','')::numeric, 0), coalesce(nullif(item->>'unitPrice','')::numeric, 0), case when item->>'currency' = 'foreign' then v_foreign_currency else v_home_currency end, coalesce(item->>'note','') from jsonb_array_elements(coalesce(p_state->'budget','[]'::jsonb)) with ordinality as rows(item, ordinality);
  insert into public.trip_notes(trip_id, author_name, content) select p_trip_id, coalesce(item->>'author',''), coalesce(item->>'text','') from jsonb_array_elements(coalesce(p_state->'notes','[]'::jsonb)) as rows(item);
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
  values (p_trip_id, auth.uid(), coalesce(nullif((select gi.display_name from public.trip_guest_identities gi where gi.trip_id = p_trip_id and gi.user_id = auth.uid()), ''), nullif((select p.display_name from public.profiles p where p.id = auth.uid()), ''), case when public.trip_role(p_trip_id) = 'owner' then '旅行拥有者' else '同行者' end), case when public.trip_role(p_trip_id) = 'owner' then 'owner' when public.trip_role(p_trip_id) in ('editor', 'viewer') then 'member' else 'guest' end, (select s.id from public.trip_shares s where s.trip_id = p_trip_id and s.token_hash = p_token_hash and s.revoked_at is null limit 1), '更新了旅行计划');
  return true;
end;
$$;
revoke all on function public.save_trip_workspace(uuid, jsonb, text) from public;
grant execute on function public.save_trip_workspace(uuid, jsonb, text) to anon, authenticated;

create or replace function public.set_trip_guest_name(p_trip_id uuid, p_token_hash text, p_display_name text)
returns boolean language plpgsql security definer set search_path = public, extensions
as $$
begin
  if auth.uid() is null or nullif(trim(p_display_name), '') is null or char_length(trim(p_display_name)) > 80 then return false; end if;
  if not exists (select 1 from public.trip_shares where trip_id = p_trip_id and token_hash = p_token_hash and permission = 'edit' and revoked_at is null and (expires_at is null or expires_at > now())) then return false; end if;
  insert into public.trip_guest_identities(trip_id, user_id, display_name) values (p_trip_id, auth.uid(), trim(p_display_name)) on conflict (trip_id, user_id) do update set display_name = excluded.display_name, updated_at = now();
  return true;
end; $$;

create or replace function public.get_trip_edit_events(p_trip_id uuid)
returns table(id uuid, actor_name text, actor_type text, action text, section text, summary text, created_at timestamptz)
language sql security definer set search_path = public, extensions
as $$
  select e.id, e.actor_name, e.actor_type, e.action, e.section, e.summary, e.created_at from public.trip_edit_events e join public.trips t on t.id = e.trip_id where e.trip_id = p_trip_id and t.owner_id = auth.uid() order by e.created_at desc limit 100;
$$;

revoke all on function public.set_trip_guest_name(uuid, text, text) from public;
grant execute on function public.set_trip_guest_name(uuid, text, text) to anon, authenticated;
revoke all on function public.get_trip_edit_events(uuid) from public;
grant execute on function public.get_trip_edit_events(uuid) to authenticated;

commit;
