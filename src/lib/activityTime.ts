const TIME_RANGE_RE = /^(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})$/;
const SINGLE_TIME_RE = /^(\d{1,2}:\d{2})$/;

/** Splits a stored time string ("09:00–11:00", "09:00", or legacy free text) into start/end
 *  clock times for the two `<input type="time">` pickers. Legacy/unparseable text (e.g. an old
 *  "上午" period label) yields blank pickers rather than being force-coerced — the original text
 *  stays intact for display until the user actually edits the time. */
export function parseTimeRange(t: string): { start: string; end: string } {
  const value = t.trim();
  const range = TIME_RANGE_RE.exec(value);
  if (range) return { start: range[1], end: range[2] };
  const single = SINGLE_TIME_RE.exec(value);
  if (single) return { start: single[1], end: '' };
  return { start: '', end: '' };
}

export function formatTimeRange(start: string, end: string): string {
  if (start && end) return `${start}–${end}`;
  return start || end;
}
