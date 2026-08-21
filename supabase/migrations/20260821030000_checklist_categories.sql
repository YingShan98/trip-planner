-- Adds free-text categorization to the preparation checklist, mirroring packing_items.category.
-- Non-destructive: existing rows default to '其他'.

begin;

alter table public.checklist_items
  add column if not exists category text not null default '其他';

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

revoke all on function public.get_shared_trip_workspace(text) from public;
grant execute on function public.get_shared_trip_workspace(text) to anon, authenticated;

commit;
