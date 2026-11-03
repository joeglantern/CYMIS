// Shifts are planned and read in East Africa Time, wherever the device thinks it
// is. EAT is UTC+3 all year, so plain arithmetic is exact and needs no time zone data.

const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');
const local = (t: string | number) => new Date(new Date(t).getTime() + OFFSET_MS);

/** The EAT day of a moment, as YYYY-MM-DD. */
export function dayKey(t: string | number): string {
  const d = local(t);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The EAT time of a moment, as HH:MM. */
export function eatTime(t: string | number): string {
  const d = local(t);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

const keyAsUtc = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
};

export function addDays(key: string, n: number): string {
  const d = new Date(keyAsUtc(key).getTime() + n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** The moment a day and time in EAT happen, as an ISO string in UTC. */
export function toUtcIso(key: string, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(keyAsUtc(key).getTime() + h! * 3600000 + m! * 60000 - OFFSET_MS).toISOString();
}

/** "Tuesday 3 November". */
export function longDay(key: string): string {
  const d = keyAsUtc(key);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Tue 3 Nov". */
export function shortDay(key: string): string {
  const d = keyAsUtc(key);
  return `${WEEKDAYS[d.getUTCDay()]!.slice(0, 3)} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]!.slice(0, 3)}`;
}

/** Today, Tomorrow, Yesterday, or a short date. */
export function dayWord(key: string, now: number = Date.now()): string {
  const today = dayKey(now);
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  return shortDay(key);
}

/** Takes "6", "0600", "6:00" or "06.00" and gives "06:00". Null if it is not a time. */
export function parseTime(text: string): string | null {
  const t = text.trim();
  const m = /^(\d{1,2})(?:[:.]?(\d{2}))?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

/**
 * The two moments a shift form describes. An end time at or before the start
 * means the next morning, so a night shift needs no second date.
 * Equal times are refused: that is a mistake more often than a 24 hour shift.
 */
export function shiftTimes(key: string, start: string, end: string): { startsAt: string; endsAt: string; nextDay: boolean } | null {
  if (start === end) return null;
  const nextDay = end < start;
  return { startsAt: toUtcIso(key, start), endsAt: toUtcIso(nextDay ? addDays(key, 1) : key, end), nextDay };
}

interface Timed {
  startsAt: string;
  endsAt: string;
}

/** The one shift to show: the one running now, else the next, else the most recent. */
export function pickShift<T extends Timed>(shifts: readonly T[], now: number = Date.now()): T | null {
  const at = (s: string) => new Date(s).getTime();
  const sorted = [...shifts].sort((a, b) => at(a.startsAt) - at(b.startsAt));
  return (
    sorted.find((s) => at(s.startsAt) <= now && now < at(s.endsAt)) ??
    sorted.find((s) => at(s.startsAt) > now) ??
    sorted[sorted.length - 1] ??
    null
  );
}
