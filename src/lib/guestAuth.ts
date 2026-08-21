import { sb } from './supabase';

export interface TripEditEvent {
  id: string;
  actor_name: string;
  actor_type: 'owner' | 'member' | 'guest';
  action: string;
  section: string;
  summary: string;
  created_at: string;
}

export function isAnonymousUser(user: { is_anonymous?: boolean } | null | undefined): boolean {
  return user?.is_anonymous === true;
}

/** Reads the current session without creating one. Never signs in — safe to call before a captcha token exists. */
export async function getExistingGuestUser() {
  if (!sb) throw new Error('Supabase 尚未配置');
  const current = await sb.auth.getUser();
  if (current.error && current.error.name !== 'AuthSessionMissingError') {
    throw new Error(`读取访客会话：${current.error.message}`);
  }
  return current.data.user ?? null;
}

/** Reuses an existing session, or creates an anonymous one. Anonymous sign-in requires a captcha token. */
export async function ensureGuestSession(captchaToken?: string) {
  const existing = await getExistingGuestUser();
  if (existing) return existing;
  if (!sb) throw new Error('Supabase 尚未配置');
  const response = await sb.auth.signInAnonymously({ options: { captchaToken } });
  if (response.error || !response.data.user) throw new Error(response.error?.message || '无法开启访客会话');
  return response.data.user;
}

export async function setGuestName(tripId: string, token: string, displayName: string): Promise<void> {
  if (!sb) throw new Error('Supabase 尚未配置');
  const tokenHash = await sha256Hex(token);
  const response = await sb.rpc('set_trip_guest_name', {
    p_trip_id: tripId,
    p_token_hash: tokenHash,
    p_display_name: displayName.trim(),
  });
  if (response.error || response.data !== true) throw new Error(response.error?.message || '访客名称保存失败');
}

export async function getTripEditEvents(tripId: string): Promise<TripEditEvent[]> {
  if (!sb) throw new Error('Supabase 尚未配置');
  const response = await sb.rpc('get_trip_edit_events', { p_trip_id: tripId });
  if (response.error) throw new Error(`读取编辑记录：${response.error.message}`);
  return (response.data || []) as TripEditEvent[];
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
