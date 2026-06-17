/**
 * Session időpontok és dátumok normalizálása, formázása, csoportosítása.
 *
 * Mit csinál: DB/API datetime → YYYY-MM-DD + HH:mm; többnapos logika; nap fejlécek.
 * Ki használja: App, SessionsView, AgendaView, CalendarView, BookingModal, icsExport.
 * Fő exportok: {@link parseSessionDateTime}, {@link normalizeSession}, {@link groupSessionsForList}, stb.
 */

import type { Session } from '../../backend/types';
import { formatDateKey, formatDateRange } from '../i18n/dateFormat';
import { LOCALE_BCP47, type Locale } from '../i18n/locales';

/** Csak dátum: YYYY-MM-DD */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** MySQL datetime: dátum + óra:perc */
const MYSQL_DT = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;
/** Csak idő: HH:mm */
const TIME_ONLY = /^(\d{2}):(\d{2})/;

/**
 * DB/API datetime szöveg → naptári dátum + HH:mm (helyi, timezone meglepetés nélkül).
 * @param raw - start_time, end_time vagy date mező értéke
 * @returns `{ date, time }` vagy null érvénytelen inputnál
 */
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

  // Csak idő (pl. "14:30") — dátum üres marad
  if (TIME_ONLY.test(value) && !value.includes('-')) {
    const t = TIME_ONLY.exec(value)!;
    return { date: '', time: `${t[1]}:${t[2]}` };
  }

  // Utolsó esély: ISO / Date.parse
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

/**
 * API vagy demo nyers sor → egységes Session objektum a UI számára.
 * @param raw - Rekord mezők (id, title, start_time, …)
 * @returns Normalizált Session vagy null, ha nincs érvényes dátum
 */
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

/**
 * Session törölve (cancelled) státuszú-e.
 * @param session - Bármilyen objektum status mezővel
 */
export function isSessionCancelled(session: { status?: string }): boolean {
  return session.status === 'cancelled';
}

/**
 * Nap fejléc adatok dátum kulcsból (agenda, lista nézet).
 * @param dateKey - YYYY-MM-DD
 * @param locale - Nyelv (alapértelmezett: hu)
 * @returns Nap szám, hét napja, hónap rövidítés, isValid flag
 */
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

/**
 * Többnapos előadás-e (end_date > date).
 * @param session - date és opcionális end_date mezőkkel
 */
export function isMultiDaySession(session: { date: string; end_date?: string }): boolean {
  return !!session.end_date && session.end_date > session.date;
}

/**
 * A session lefedi-e az adott naptári napot (többnapos esetben is).
 * @param session - Session dátum mezőkkel
 * @param dateStr - Ellenőrzendő nap YYYY-MM-DD
 */
export function sessionSpansDate(
  session: { date: string; end_date?: string },
  dateStr: string,
): boolean {
  const end = session.end_date && session.end_date >= session.date ? session.end_date : session.date;
  return dateStr >= session.date && dateStr <= end;
}

/**
 * Lista/agenda csoportosítás: többnapos egyszer, egynapos dátum szerint.
 * @param items - Session tömb
 * @returns multiDay lista + singleDayByDate (rendezett dátumok és csoportok)
 */
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

/**
 * Inkluzív dátumtartomány minden napja YYYY-MM-DD formában.
 * @param start - Kezdő dátum
 * @param end - Záró dátum
 * @returns Napok tömbje; érvénytelen tartománynál [start]
 */
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

/**
 * Session dátum vagy dátumtartomány megjelenítése lokalizálva.
 * @param session - date, end_date mezőkkel
 * @param locale - Nyelv
 * @param style - 'short' vagy 'long' formátum
 */
export function formatSessionDateRange(
  session: { date: string; end_date?: string },
  locale: Locale = 'hu',
  style: 'short' | 'long' = 'short',
): string {
  const end = session.end_date ?? session.date;
  if (!isMultiDaySession(session)) return formatDateKey(session.date, locale, style);
  return formatDateRange(session.date, end, locale, style);
}

/**
 * A megadott dátum kulcs a mai nap-e (helyi idő szerint).
 * @param dateKey - YYYY-MM-DD
 */
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
