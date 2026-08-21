import { sb } from './supabase';
import { blankState } from '../state';
import type { Activity, BudgetItem, ChecklistItem, Day, Hotel, LinkItem, NoteItem, PackingItem, TransportItem, TripState } from '../types';

export interface TripMeta {
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
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripWorkspace {
  trip: TripMeta;
  state: TripState;
  sharePermission?: 'view' | 'edit';
  requiresEditPassword?: boolean;
}

function requireClient() {
  if (!sb) throw new Error('Supabase 尚未配置');
  return sb;
}

function result<T>(label: string, response: { data: T | null; error: { message: string } | null }): T {
  if (response.error) throw new Error(`${label}：${response.error.message}`);
  return response.data as T;
}

const TRIP_META_COLUMNS = 'id,slug,title,destination,description,start_date,end_date,home_currency,foreign_currency,exchange_rate,visibility,owner_id,cover_image_url,created_at,updated_at';

export async function loadTrip(slug: string): Promise<TripWorkspace> {
  const client = requireClient();
  const trip = result('读取旅行', await client.from('trips').select(TRIP_META_COLUMNS).eq('slug', slug).single()) as TripMeta;
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
  return { trip, state };
}

async function saveTripByRpc(tripId: string, state: TripState, tokenHash?: string, password?: string): Promise<void> {
  const client = requireClient();
  const response = await client.rpc('save_trip_workspace', { p_trip_id: tripId, p_state: state, p_token_hash: tokenHash || null, p_password: password || null });
  if (response.error || response.data !== true) throw new Error(response.error?.message || '保存失败');
}

export async function saveTrip(slug: string, state: TripState): Promise<void> {
  const client = requireClient();
  const trip = result('读取旅行', await client.from('trips').select('id').eq('slug', slug).single()) as { id: string };
  await saveTripByRpc(trip.id, state);
}

export async function saveSharedTrip(token: string, state: TripState, password?: string): Promise<void> {
  const client = requireClient();
  const tokenHash = await sha256Hex(token);
  const workspace = await client.rpc('get_shared_trip_workspace', { p_token_hash: tokenHash });
  if (workspace.error || !workspace.data) throw new Error(workspace.error?.message || '分享链接无效、已撤销或已过期');
  const trip = workspace.data as TripWorkspace;
  if (trip.sharePermission !== 'edit') throw new Error('此分享链接没有编辑权限');
  await saveTripByRpc(trip.trip.id, state, tokenHash, password);
}

export async function verifyEditPassword(token: string, password: string): Promise<boolean> {
  const client = requireClient();
  const tokenHash = await sha256Hex(token);
  const response = await client.rpc('verify_trip_edit_password', { p_token_hash: tokenHash, p_password: password });
  if (response.error) throw new Error(`验证密码：${response.error.message}`);
  return response.data === true;
}

export async function setTripEditPassword(tripId: string, password: string): Promise<void> {
  const client = requireClient();
  const response = await client.rpc('set_trip_edit_password', { p_trip_id: tripId, p_password: password || null });
  if (response.error || response.data !== true) throw new Error(response.error?.message || '密码设置失败');
}

export async function createTrip(input: { slug: string; title: string; destination: string; start_date: string | null; end_date: string | null; home_currency: string; description: string; cover_image_url?: string | null; state: TripState }) {
  const client = requireClient();
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw new Error(`读取登录用户：${userError.message}`);
  if (!userData.user) throw new Error('请先登录');
  const trip = result('创建旅行', await client.from('trips').insert({ owner_id: userData.user.id, slug: input.slug, title: input.title, destination: input.destination, start_date: input.start_date, end_date: input.end_date, home_currency: input.home_currency, description: input.description, visibility: 'public', foreign_currency: input.state.foreignCurrency || '', exchange_rate: input.state.exchangeRate === '' ? null : Number(input.state.exchangeRate), cover_image_url: input.cover_image_url?.trim() || null }).select('slug').single()) as { slug: string };
  await saveTrip(trip.slug, input.state);
  return trip.slug as string;
}

export async function deleteTrip(slug: string) {
  const client = requireClient();
  const trip = result('读取旅行', await client.from('trips').select('id').eq('slug', slug).single()) as { id: string };
  result('删除旅行', await client.from('trips').delete().eq('id', trip.id));
  return true;
}

export async function getTripRole(tripId: string): Promise<'owner' | 'editor' | 'viewer' | null> {
  const client = requireClient();
  const { data, error } = await client.rpc('trip_role', { p_trip_id: tripId });
  if (error) throw new Error(`读取旅行权限：${error.message}`);
  return data === 'owner' || data === 'editor' || data === 'viewer' ? data : null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createShare(tripId: string, permission: 'view' | 'edit', expiresAt: string | null): Promise<string> {
  const client = requireClient();
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = toBase64Url(bytes);
  const tokenHash = await sha256Hex(token);
  const { data, error } = await client.rpc('create_trip_share', {
    p_trip_id: tripId, p_token_hash: tokenHash, p_permission: permission, p_expires_at: expiresAt,
  });
  if (error || !data) throw new Error(error?.message || '分享链接创建失败');
  return token;
}

export async function createViewShare(tripId: string): Promise<string> {
  return createShare(tripId, 'view', null);
}

export async function loadSharedTrip(token: string): Promise<TripWorkspace> {
  const client = requireClient();
  const tokenHash = await sha256Hex(token);
  const { data, error } = await client.rpc('get_shared_trip_workspace', { p_token_hash: tokenHash });
  if (error) throw new Error(`读取分享行程：${error.message}`);
  if (!data) throw new Error('分享链接无效、已撤销或已过期');
  return data as TripWorkspace;
}

export async function revokeShares(tripId: string): Promise<number> {
  const client = requireClient();
  const { data, error } = await client.rpc('revoke_trip_shares', { p_trip_id: tripId });
  if (error) throw new Error(`撤销分享链接：${error.message}`);
  return Number(data || 0);
}
