export function formatDate(d?: string | null): string {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

export function dateRange(t: { start_date?: string | null; end_date?: string | null }): string {
  if (!t.start_date && !t.end_date) return '日期待定';
  if (t.start_date && t.end_date) return `${formatDate(t.start_date)} – ${formatDate(t.end_date)}`;
  return formatDate(t.start_date || t.end_date);
}
