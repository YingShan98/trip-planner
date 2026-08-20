import { sb } from './supabase';
import { blankState } from '../state';
import type { Activity, BudgetItem, ChecklistItem, Day, Hotel, LinkItem, NoteItem, PackingItem, TransportItem, TripState } from '../types';

export interface V2TripMeta {
  id: string;
  slug: string;
  title: string;
  destination: string;
  description: string;
  start_date: string | null;
  end_date: string | null;
  home_currency: string;
  foreign_currency: string;
  exchange_rate: number | string | null;
  visibility: 'private' | 'public' | 'link';
  owner_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface V2TripWorkspace {
  trip: V2TripMeta;
  state: TripState;
}

function requireClient() {
  if (!sb) throw new Error('Supabase 尚未配置');
  return sb;
}

function result<T>(label: string, response: { data: T | null; error: { message: string } | null }): T {
  if (response.error) throw new Error(`${label}：${response.error.message}`);
  return response.data as T;
}

export async function loadV2Trip(slug: string): Promise<V2TripWorkspace> {
  const client = requireClient();
  const trip = result('读取旅行', await client.from('trips').select('*').eq('slug', slug).single()) as V2TripMeta;
  const days = result('读取行程日', await client.from('trip_days').select('*').eq('trip_id', trip.id).order('day_number')) as Array<Record<string, unknown>>;
  const dayIds = days.map((day) => day.id as string);
  const activities = dayIds.length
    ? result('读取活动', await client.from('activities').select('*').in('day_id', dayIds).order('sort_order')) as Array<Record<string, unknown>>
    : [];
  const activityIds = activities.map((activity) => activity.id as string);
  const activityLinks = activityIds.length
    ? result('读取活动链接', await client.from('activity_links').select('*').in('activity_id', activityIds).order('sort_order')) as Array<Record<string, unknown>>
    : [];
  const [checklist, packing, accommodations, transport, budget, notes] = await Promise.all([
    client.from('checklist_items').select('*').eq('trip_id', trip.id).order('sort_order'),
    client.from('packing_items').select('*').eq('trip_id', trip.id).order('sort_order'),
    client.from('accommodations').select('*').eq('trip_id', trip.id).order('sort_order'),
    client.from('transport_options').select('*').eq('trip_id', trip.id).order('sort_order'),
    client.from('budget_items').select('*').eq('trip_id', trip.id).order('sort_order'),
    client.from('trip_notes').select('*').eq('trip_id', trip.id).order('created_at', { ascending: false }),
  ]);
  const accommodationsRows = result('读取住宿', accommodations) as Array<Record<string, unknown>>;
  const accommodationIds = accommodationsRows.map((item) => item.id as string);
  const accommodationLinks = accommodationIds.length
    ? result('读取住宿链接', await client.from('accommodation_links').select('*').in('accommodation_id', accommodationIds).order('sort_order')) as Array<Record<string, unknown>>
    : [];

  const state = blankState();
  state.days = days.map((day, dayIndex) => ({
    n: dayIndex + 1,
    title: String(day.title || `Day ${dayIndex + 1}`),
    intensity: (day.intensity || 'light') as Day['intensity'],
    steps: String(day.walking_note || ''),
    mapUrl: String(day.map_url || ''),
    notes: String(day.notes || ''),
    items: activities.filter((activity) => activity.day_id === day.id).map((activity) => ({
      t: String(activity.time_label || ''),
      x: String(activity.title || ''),
      move: String(activity.transport_note || ''),
      fee: String(activity.fee_note || ''),
      link: activityLinks.filter((link) => link.activity_id === activity.id).map((link) => ({ label: String(link.label || ''), url: String(link.url || '') })),
    } as Activity)),
  }));
  state.checklist = (result('读取准备清单', checklist) as Array<Record<string, unknown>>).map((item) => ({ id: String(item.id), text: String(item.text || ''), done: item.is_done === true } as ChecklistItem));
  state.packing = (result('读取打包清单', packing) as Array<Record<string, unknown>>).map((item) => ({ id: String(item.id), text: String(item.text || ''), done: item.is_done === true, category: String(item.category || '其他') } as PackingItem));
  state.hotels = accommodationsRows.map((item) => ({
    rank: String(item.rank_label || ''), name: String(item.name || ''), addr: String(item.address || ''), warn: String(item.warning || ''),
    pointsText: String(item.pros_cons || ''), notes: String(item.notes || ''),
    link: accommodationLinks.filter((link) => link.accommodation_id === item.id).map((link) => ({ label: String(link.label || ''), url: String(link.url || '') } as LinkItem)),
  } as Hotel));
  state.transport = (result('读取交通', transport) as Array<Record<string, unknown>>).map((item) => ({
    type: String(item.type || ''), description: String(item.description || ''), price: String(item.price_label || ''),
    amount: item.amount === null ? '' : Number(item.amount), currency: item.currency_code === trip.home_currency ? 'home' : 'foreign',
  } as TransportItem));
  state.budget = (result('读取预算', budget) as Array<Record<string, unknown>>).map((item) => ({
    category: String(item.category || ''), unit: String(item.unit || ''), quantity: Number(item.quantity || 0), unitPrice: Number(item.unit_price || 0),
    currency: item.currency_code === trip.home_currency ? 'home' : 'foreign', note: String(item.note || ''),
  } as BudgetItem));
  state.notes = (result('读取留言', notes) as Array<Record<string, unknown>>).map((item) => ({ author: String(item.author_name || ''), text: String(item.content || ''), ts: String(item.created_at || '') } as NoteItem));
  state.foreignCurrency = trip.foreign_currency || '';
  state.exchangeRate = trip.exchange_rate ?? '';
  state.freeEdit = false;

  return { trip, state };
}

export async function saveV2Trip(slug: string, state: TripState): Promise<void> {
  const client = requireClient();
  const trip = result('读取旅行', await client.from('trips').select('id,home_currency').eq('slug', slug).single()) as { id: string; home_currency: string };
  const home = trip.home_currency;
  const foreign = state.foreignCurrency || 'CNY';

  const days = result('清理行程', await client.from('trip_days').delete().eq('trip_id', trip.id));
  void days;
  for (const [dayIndex, day] of state.days.entries()) {
    const dayRow = result('保存行程日', await client.from('trip_days').insert({
      trip_id: trip.id, day_number: dayIndex + 1, title: day.title, intensity: day.intensity, walking_note: day.steps, map_url: day.mapUrl, notes: day.notes,
    }).select('id').single()) as { id: string };
    for (const [activityIndex, activity] of day.items.entries()) {
      const activityRow = result('保存活动', await client.from('activities').insert({
        day_id: dayRow.id, sort_order: activityIndex, time_label: activity.t, title: activity.x, transport_note: activity.move, fee_note: activity.fee,
      }).select('id').single()) as { id: string };
      const links = activity.link.filter((link) => link.url.trim()).map((link, linkIndex) => ({ activity_id: activityRow.id, label: link.label, url: link.url, sort_order: linkIndex }));
      if (links.length) result('保存活动链接', await client.from('activity_links').insert(links));
    }
  }

  const cleanup = await Promise.all([
    client.from('checklist_items').delete().eq('trip_id', trip.id),
    client.from('packing_items').delete().eq('trip_id', trip.id),
    client.from('accommodations').delete().eq('trip_id', trip.id),
    client.from('transport_options').delete().eq('trip_id', trip.id),
    client.from('budget_items').delete().eq('trip_id', trip.id),
    client.from('trip_notes').delete().eq('trip_id', trip.id),
  ]);
  cleanup.forEach((response, index) => result(`清理旅行数据 ${index + 1}`, response));
  if (state.checklist.length) result('保存准备清单', await client.from('checklist_items').insert(state.checklist.map((item, index) => ({ trip_id: trip.id, text: item.text, is_done: item.done, sort_order: index }))));
  if (state.packing.length) result('保存打包清单', await client.from('packing_items').insert(state.packing.map((item, index) => ({ trip_id: trip.id, category: item.category, text: item.text, is_done: item.done, sort_order: index }))));
  for (const [index, hotel] of state.hotels.entries()) {
    const hotelRow = result('保存住宿', await client.from('accommodations').insert({ trip_id: trip.id, sort_order: index, rank_label: hotel.rank, name: hotel.name, address: hotel.addr, warning: hotel.warn, pros_cons: hotel.pointsText, notes: hotel.notes }).select('id').single()) as { id: string };
    const links = hotel.link.filter((link) => link.url.trim()).map((link, linkIndex) => ({ accommodation_id: hotelRow.id, label: link.label, url: link.url, sort_order: linkIndex }));
    if (links.length) result('保存住宿链接', await client.from('accommodation_links').insert(links));
  }
  if (state.transport.length) result('保存交通', await client.from('transport_options').insert(state.transport.map((item, index) => ({ trip_id: trip.id, sort_order: index, type: item.type, description: item.description, price_label: item.price, amount: item.amount === '' ? null : Number(item.amount), currency_code: item.currency === 'home' ? home : foreign }))));
  if (state.budget.length) result('保存预算', await client.from('budget_items').insert(state.budget.map((item, index) => ({ trip_id: trip.id, sort_order: index, category: item.category, unit: item.unit, quantity: Number(item.quantity) || 0, unit_price: Number(item.unitPrice) || 0, currency_code: item.currency === 'home' ? home : foreign, note: item.note }))));
  if (state.notes.length) result('保存留言', await client.from('trip_notes').insert(state.notes.map((item) => ({ trip_id: trip.id, author_name: item.author, content: item.text }))));
  result('保存旅行设置', await client.from('trips').update({ foreign_currency: foreign, exchange_rate: state.exchangeRate === '' ? null : Number(state.exchangeRate) }).eq('id', trip.id));
}

export async function createV2Trip(input: { slug: string; title: string; destination: string; start_date: string | null; end_date: string | null; home_currency: string; description: string; state: TripState }) {
  const client = requireClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw new Error(`读取登录用户：${userError.message}`);
  if (!userData.user) throw new Error('请先登录');
  const trip = result('创建旅行', await client.from('trips').insert({ owner_id: userData.user.id, slug: input.slug, title: input.title, destination: input.destination, start_date: input.start_date, end_date: input.end_date, home_currency: input.home_currency, description: input.description, visibility: 'public', foreign_currency: input.state.foreignCurrency || '', exchange_rate: input.state.exchangeRate === '' ? null : Number(input.state.exchangeRate) }).select('slug').single()) as { slug: string };
  await saveV2Trip(trip.slug, input.state);
  return trip.slug as string;
}

export async function deleteV2Trip(slug: string) {
  const client = requireClient();
  const trip = result('读取旅行', await client.from('trips').select('id').eq('slug', slug).single()) as { id: string };
  result('删除旅行', await client.from('trips').delete().eq('id', trip.id));
  return true;
}
