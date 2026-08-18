import { sb } from './supabase';
import { toast } from './toast';

export async function deleteTripBySlug(slug: string): Promise<boolean> {
  if (!sb) return false;
  if (!confirm('删除这趟旅行？此操作不可恢复。')) return false;
  const pw = prompt('请输入系统管理密码');
  if (!pw) return false;
  const { data, error } = await sb.rpc('delete_trip', { p_admin_password: pw, p_slug: slug });
  if (error || data !== true) {
    toast(error?.message || '删除失败');
    return false;
  }
  toast('旅行已删除');
  return true;
}

export async function copyTripLink(slug: string): Promise<void> {
  const url = new URL(location.href);
  url.searchParams.set('trip', slug);
  try {
    await navigator.clipboard.writeText(url.href);
    toast('共享链接已复制');
  } catch {
    prompt('复制这个链接', url.href);
  }
}
