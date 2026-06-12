import type { Session } from '../../backend/types';
import { formatDateKey, formatDateRange } from '../i18n/dateFormat';
import { LOCALE_BCP47, type Locale } from '../i18n/locales';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MYSQL_DT = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;
const TIME_ONLY = /^(\d{2}):(\d{2})/;

/** Parse DB/API datetime into calendar date + HH:mm (local, no timezone surprises). */
export function parseSessionDateTime(raw: string): { date: string; time: string } | null {
  if (!raw) return null;
  const value = raw.trim();

  if (DATE_ONLY.test(value)) {
    return { date: value, time: '' };
  }

  const mysql = MYSQL_DT.exec(value);
  if (mysql) {
    return {
      date: `${mysql[1]}-${mysql[2]}-${mysql[3]}`,
      time: `${mysql[4]}:${mysql[5]}`,
    };
  }

  if (TIME_ONLY.test(value) && !value.includes('-')) {
    const t = TIME_ONLY.exec(value)!;
    return { date: '', time: `${t[1]}:${t[2]}` };
  }

  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }

  return null;
}

/** Normalize API/demo rows so the UI always gets YYYY-MM-DD + HH:mm. */
export function normalizeSession(raw: Record<string, unknown>): Session | null {
  const start = parseSessionDateTime(String(raw.start_time ?? ''));
  const end = parseSessionDateTime(String(raw.end_time ?? ''));

  const dateFromField = parseSessionDateTime(String(raw.date ?? ''))?.date
    ?? String(raw.date ?? '').slice(0, 10);

  const date =
    DATE_ONLY.test(dateFromField) ? dateFromField : start?.date ?? '';

  if (!DATE_ONLY.test(date)) return null;

  const endDate = end?.date && DATE_ONLY.test(end.date) ? end.date : date;

  return {
    id: Number(raw.id),
    title: String(raw.title ?? ''),
    description: raw.description != null ? String(raw.description) : '',
    date,
    end_date: endDate,
    start_time: start?.time || String(raw.start_time ?? ''),
    end_time: end?.time || String(raw.end_time ?? ''),
    room_id: Number(raw.room_id ?? 0),
    speaker_id: Number(raw.speaker_id ?? 0),
    room_name: String(raw.room_name ?? ''),
    speaker_name: String(raw.speaker_name ?? ''),
    speaker_bio:
      raw.speaker_bio != null && String(raw.speaker_bio).trim()
        ? String(raw.speaker_bio)
        : null,
    color: (raw.color as Session['color']) ?? 'blue',
    status: String(raw.status ?? 'scheduled').toLowerCase() === 'cancelled' ? 'cancelled' : 'scheduled',
  };
}

export function isSessionCancelled(session: { status?: string }): boolean {
  return session.status === 'cancelled';
}

export function formatDayHeader(dateKey: string, locale: Locale = 'hu') {
  const bcp47 = LOCALE_BCP47[locale];
  const match = DATE_ONLY.exec(dateKey);
  if (!match) {
    return { dayNum: 0, weekday: '', monthShort: '', isValid: false };
  }

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(y, m - 1, d);

  return {
    dayNum: d,
    weekday: date.toLocaleDateString(bcp47, { weekday: 'long' }),
    monthShort: date.toLocaleDateString(bcp47, { month: 'short' }).toUpperCase(),
    isValid: true,
  };
}

export function isMultiDaySession(session: { date: string; end_date?: string }): boolean {
  return !!session.end_date && session.end_date > session.date;
}

export function sessionSpansDate(
  session: { date: string; end_date?: string },
  dateStr: string,
): boolean {
  const end = session.end_date && session.end_date >= session.date ? session.end_date : session.date;
  return dateStr >= session.date && dateStr <= end;
}

/** List/agenda grouping: multi-day sessions once, single-day by date. */
export function groupSessionsForList(items: Session[]): {
  multiDay: Session[];
  singleDayByDate: { sortedDates: string[]; grouped: Record<string, Session[]> };
} {
  const multiDay: Session[] = [];
  const grouped: Record<string, Session[]> = {};

  [...items]
    .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time))
    .forEach((s) => {
      if (isMultiDaySession(s)) {
        if (!multiDay.some((ev) => ev.id === s.id)) multiDay.push(s);
        return;
      }
      if (!grouped[s.date]) grouped[s.date] = [];
      if (!grouped[s.date].some((ev) => ev.id === s.id)) grouped[s.date].push(s);
    });

  return {
    multiDay,
    singleDayByDate: { sortedDates: Object.keys(grouped).sort(), grouped },
  };
}

export function enumerateDateRange(start: string, end: string): string[] {
  if (!DATE_ONLY.test(start) || !DATE_ONLY.test(end) || end < start) return [start];
  const dates: string[] = [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);
  while (cur <= last) {
    const pad = (n: number) => String(n).padStart(2, '0');
    dates.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

export function formatSessionDateRange(
  session: { date: string; end_date?: string },
  locale: Locale = 'hu',
  style: 'short' | 'long' = 'short',
): string {
  const end = session.end_date ?? session.date;
  if (!isMultiDaySession(session)) return formatDateKey(session.date, locale, style);
  return formatDateRange(session.date, end, locale, style);
}

export function isTodayDateKey(dateKey: string): boolean {
  const match = DATE_ONLY.exec(dateKey);
  if (!match) return false;
  const now = new Date();
  return (
    Number(match[1]) === now.getFullYear() &&
    Number(match[2]) === now.getMonth() + 1 &&
    Number(match[3]) === now.getDate()
  );
}
