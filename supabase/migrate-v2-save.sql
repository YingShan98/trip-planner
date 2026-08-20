-- Run after migrate-v2-permissions.sql.
-- Replace multi-request delete/reinsert saves with one database transaction.

create or replace function public.save_trip_workspace(p_trip_id uuid, p_state jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_role text;
  v_day jsonb;
  v_activity jsonb;
  v_link jsonb;
  v_hotel jsonb;
  v_index integer;
  v_day_id uuid;
  v_activity_id uuid;
  v_hotel_id uuid;
  v_home_currency text;
  v_foreign_currency text;
begin
  v_role := public.trip_role(p_trip_id);
  if v_role not in ('owner', 'editor') then return false; end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then return false; end if;

  v_home_currency := coalesce((select home_currency from public.trips where id = p_trip_id), 'MYR');
  v_foreign_currency := coalesce(nullif(p_state->>'foreignCurrency', ''), 'CNY');
  update public.trips
  set foreign_currency = v_foreign_currency,
      exchange_rate = nullif(p_state->>'exchangeRate', '')::numeric,
      updated_at = now()
  where id = p_trip_id;

  delete from public.checklist_items where trip_id = p_trip_id;
  delete from public.packing_items where trip_id = p_trip_id;
  delete from public.accommodations where trip_id = p_trip_id;
  delete from public.transport_options where trip_id = p_trip_id;
  delete from public.budget_items where trip_id = p_trip_id;
  delete from public.trip_notes where trip_id = p_trip_id;
  delete from public.trip_days where trip_id = p_trip_id;

  insert into public.checklist_items(trip_id, text, is_done, sort_order)
  select p_trip_id, coalesce(item->>'text',''), coalesce((item->>'done')::boolean, false), ordinality - 1
  from jsonb_array_elements(coalesce(p_state->'checklist','[]'::jsonb)) with ordinality as rows(item, ordinality);

  insert into public.packing_items(trip_id, category, text, is_done, sort_order)
  select p_trip_id, coalesce(item->>'category','其他'), coalesce(item->>'text',''), coalesce((item->>'done')::boolean, false), ordinality - 1
  from jsonb_array_elements(coalesce(p_state->'packing','[]'::jsonb)) with ordinality as rows(item, ordinality);

  insert into public.transport_options(trip_id, sort_order, type, description, price_label, amount, currency_code)
  select p_trip_id, ordinality - 1, coalesce(item->>'type',''), coalesce(item->>'description',''), coalesce(item->>'price',''),
    nullif(item->>'amount','')::numeric,
    case when item->>'currency' = 'foreign' then v_foreign_currency else v_home_currency end
  from jsonb_array_elements(coalesce(p_state->'transport','[]'::jsonb)) with ordinality as rows(item, ordinality);

  insert into public.budget_items(trip_id, sort_order, category, unit, quantity, unit_price, currency_code, note)
  select p_trip_id, ordinality - 1, coalesce(item->>'category',''), coalesce(item->>'unit',''),
    coalesce(nullif(item->>'quantity','')::numeric, 0), coalesce(nullif(item->>'unitPrice','')::numeric, 0),
    case when item->>'currency' = 'foreign' then v_foreign_currency else v_home_currency end,
    coalesce(item->>'note','')
  from jsonb_array_elements(coalesce(p_state->'budget','[]'::jsonb)) with ordinality as rows(item, ordinality);

  insert into public.trip_notes(trip_id, author_name, content)
  select p_trip_id, coalesce(item->>'author',''), coalesce(item->>'text','')
  from jsonb_array_elements(coalesce(p_state->'notes','[]'::jsonb)) as rows(item);

  v_index := 0;
  for v_day in select value from jsonb_array_elements(coalesce(p_state->'days','[]'::jsonb)) loop
    insert into public.trip_days(trip_id, day_number, title, intensity, walking_note, map_url, notes)
    values (p_trip_id, v_index + 1, coalesce(v_day->>'title','Day ' || (v_index + 1)), coalesce(v_day->>'intensity','light'), coalesce(v_day->>'steps',''), coalesce(v_day->>'mapUrl',''), coalesce(v_day->>'notes',''))
    returning id into v_day_id;

    for v_activity in select value from jsonb_array_elements(coalesce(v_day->'items','[]'::jsonb)) loop
      insert into public.activities(day_id, sort_order, time_label, title, transport_note, fee_note)
      values (v_day_id, v_index, coalesce(v_activity->>'t',''), coalesce(v_activity->>'x',''), coalesce(v_activity->>'move',''), coalesce(v_activity->>'fee',''))
      returning id into v_activity_id;
      v_index := v_index + 1;
      for v_link in select value from jsonb_array_elements(coalesce(v_activity->'link','[]'::jsonb)) loop
        if nullif(trim(v_link->>'url'), '') is not null then
          insert into public.activity_links(activity_id, label, url, sort_order)
          values (v_activity_id, coalesce(nullif(v_link->>'label',''), v_link->>'url'), v_link->>'url', 0);
        end if;
      end loop;
    end loop;
    v_index := v_index + 1;
  end loop;

  v_index := 0;
  for v_hotel in select value from jsonb_array_elements(coalesce(p_state->'hotels','[]'::jsonb)) loop
    insert into public.accommodations(trip_id, sort_order, rank_label, name, address, warning, pros_cons, notes)
    values (p_trip_id, v_index, coalesce(v_hotel->>'rank',''), coalesce(v_hotel->>'name',''), coalesce(v_hotel->>'addr',''), coalesce(v_hotel->>'warn',''), coalesce(v_hotel->>'pointsText',''), coalesce(v_hotel->>'notes',''))
    returning id into v_hotel_id;
    for v_link in select value from jsonb_array_elements(coalesce(v_hotel->'link','[]'::jsonb)) loop
      if nullif(trim(v_link->>'url'), '') is not null then
        insert into public.accommodation_links(accommodation_id, label, url, sort_order)
        values (v_hotel_id, coalesce(nullif(v_link->>'label',''), v_link->>'url'), v_link->>'url', 0);
      end if;
    end loop;
    v_index := v_index + 1;
  end loop;

  return true;
end;
$$;

revoke all on function public.save_trip_workspace(uuid, jsonb) from public;
grant execute on function public.save_trip_workspace(uuid, jsonb) to anon, authenticated;
