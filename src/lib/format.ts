export function formatDate(d?: string | null): string {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

export function dateRange(t: { start_date?: string | null; end_date?: string | null }): string {
  if (!t.start_date && !t.end_date) return '日期待定';
  if (t.start_date && t.end_date) return `${formatDate(t.start_date)} – ${formatDate(t.end_date)}`;
  return formatDate(t.start_date || t.end_date);
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/** Adds `days` (may be negative) to an ISO date string, returning an ISO date string. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The calendar date for day index `dayIndex` (0-based) of a trip starting on `startDate`, or null if unset. */
export function dayDate(startDate: string | null | undefined, dayIndex: number): string | null {
  return startDate ? addDays(startDate, dayIndex) : null;
}

/** e.g. "3月8日 周一" */
export function formatDateWithWeekday(d?: string | null): string {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  return `${date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })} 周${WEEKDAY_LABELS[date.getDay()]}`;
}

export type TripPhase = 'upcoming' | 'ongoing' | 'past' | 'undated';

/** Days until departure (negative once started), plus a coarse phase for badges/sorting. */
export function tripCountdown(startDate?: string | null, endDate?: string | null): { phase: TripPhase; days: number | null } {
  if (!startDate) return { phase: 'undated', days: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate + 'T00:00:00');
  const end = endDate ? new Date(endDate + 'T00:00:00') : start;
  const msPerDay = 86400000;
  if (today < start) return { phase: 'upcoming', days: Math.round((start.getTime() - today.getTime()) / msPerDay) };
  if (today <= end) return { phase: 'ongoing', days: 0 };
  return { phase: 'past', days: Math.round((today.getTime() - end.getTime()) / msPerDay) };
}

/** Human label for tripCountdown()'s result, e.g. "距出发还有 12 天". */
export function tripCountdownLabel(startDate?: string | null, endDate?: string | null): string | null {
  const { phase, days } = tripCountdown(startDate, endDate);
  if (phase === 'undated') return null;
  if (phase === 'upcoming') return days === 0 ? '今天出发！' : `距出发还有 ${days} 天`;
  if (phase === 'ongoing') return '旅行进行中';
  return `已结束 ${days} 天`;
}
