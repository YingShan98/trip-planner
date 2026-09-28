export const TIME_OPTIONS = ['清晨', '上午', '午间', '下午', '傍晚', '晚间', '全天'] as const;
export type TimeOption = typeof TIME_OPTIONS[number];

export const DEFAULT_TIME: TimeOption = '上午';

export const isValidTimeOption = (t: unknown): t is TimeOption =>
  typeof t === 'string' && (TIME_OPTIONS as readonly string[]).includes(t);
