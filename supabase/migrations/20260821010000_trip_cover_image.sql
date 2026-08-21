-- Optional cover image URL per trip, shown on the trip list card and the trip hero.
-- Non-destructive: existing trips get cover_image_url = null, meaning "no image, show placeholder".

begin;

alter table public.trips
  add column if not exists cover_image_url text;

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
    'checklist', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'text', c.text, 'done', c.is_done) order by c.sort_order) from public.checklist_items c where c.trip_id = v_trip_id), '[]'::jsonb),
    'packing', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'text', p.text, 'done', p.is_done, 'category', p.category) order by p.sort_order) from public.packing_items p where p.trip_id = v_trip_id), '[]'::jsonb),
    'hotels', coalesce((select jsonb_agg(jsonb_build_object('rank', h.rank_label, 'name', h.name, 'addr', h.address, 'warn', h.warning, 'pointsText', h.pros_cons, 'notes', h.notes, 'link', coalesce((select jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url) order by l.sort_order) from public.accommodation_links l where l.accommodation_id = h.id), '[]'::jsonb)) order by h.sort_order) from public.accommodations h where h.trip_id = v_trip_id), '[]'::jsonb),
    'transport', coalesce((select jsonb_agg(jsonb_build_object('type', x.type, 'description', x.description, 'price', x.price_label, 'amount', x.amount, 'currency', case when x.currency_code = t.home_currency then 'home' else 'foreign' end) order by x.sort_order) from public.transport_options x join public.trips t on t.id = x.trip_id where x.trip_id = v_trip_id), '[]'::jsonb),
    'budget', coalesce((select jsonb_agg(jsonb_build_object('category', b.category, 'unit', b.unit, 'quantity', b.quantity, 'unitPrice', b.unit_price, 'currency', case when b.currency_code = t.home_currency then 'home' else 'foreign' end, 'note', b.note) order by b.sort_order) from public.budget_items b join public.trips t on t.id = b.trip_id where b.trip_id = v_trip_id), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('author', n.author_name, 'text', n.content, 'ts', n.created_at) order by n.created_at desc) from public.trip_notes n where n.trip_id = v_trip_id), '[]'::jsonb),
    'collapsed', '{}'::jsonb, 'foreignCurrency', v_trip->>'foreign_currency', 'exchangeRate', v_trip->>'exchange_rate'
  ) into v_state;
  return jsonb_build_object('trip', v_trip, 'state', v_state, 'sharePermission', (select permission from public.trip_shares where token_hash = p_token_hash and trip_id = v_trip_id and revoked_at is null and (expires_at is null or expires_at > now()) limit 1), 'requiresEditPassword', coalesce(v_requires_password, false));
end; $$;

revoke all on function public.get_shared_trip_workspace(text) from public;
grant execute on function public.get_shared_trip_workspace(text) to anon, authenticated;

commit;
