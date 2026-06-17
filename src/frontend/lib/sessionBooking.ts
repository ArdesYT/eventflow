/**
 * Session foglalás űrlap ↔ API, ütközések, sablonok, időformázás.
 *
 * Mit csinál: BookingFormData konverzió, terem/előadó ütközés, 2 órás buffer, sablonok.
 * Ki használja: BookingModal, ScheduleConflictModal, BulkSessionToolbar.
 * Fő exportok: {@link toBookingFormData}, {@link findBookingConflicts}, {@link SESSION_TEMPLATES}, stb.
 */

import type {
  BookingFormData,
  CreateSessionBody,
  EventColor,
  Session,
  SessionTemplateId,
} from '../../backend/types';
import { formatDateKey, formatTimeKey } from '../i18n/dateFormat';
import type { Locale } from '../i18n/locales';
import { enumerateDateRange, isMultiDaySession, isSessionCancelled } from './sessionFormat';

/**
 * Meglévő Session → szerkesztő űrlap adatok.
 * @param session - Forrás session
 * @returns BookingFormData (idő HH:mm-re vágva)
 */
export function toBookingFormData(session: Session): BookingFormData {
  const parseTime = (value: string) => {
    const match = value.match(/(\d{2}:\d{2})(?::\d{2})?$/);
    return match ? match[1] : value;
  };

  return {
    title: session.title,
    description: session.description ?? '',
    date: session.date,
    end_date: session.end_date ?? session.date,
    start_time: parseTime(session.start_time),
    end_time: parseTime(session.end_time),
    room_id: session.room_id,
    speaker_id: session.speaker_id,
    room_name: session.room_name,
    speaker_name: session.speaker_name,
    color: session.color,
  };
}

/**
 * Session másolása új címmel (duplikálás űrlaphoz).
 * @param session - Forrás session
 * @param titleSuffix - Hozzáfűzendő szöveg a címhez
 */
export function duplicateBookingFormData(
  session: Session,
  titleSuffix: string,
): BookingFormData {
  const base = toBookingFormData(session);
  return {
    ...base,
    title: `${session.title}${titleSuffix}`.trim(),
  };
}

/**
 * Űrlap adatok → API POST/PATCH body (MySQL datetime stringekkel).
 * @param data - BookingFormData
 * @returns CreateSessionBody részhalmaz időpont és meta mezőkkel
 */
export function bookingFormToApiBody(
  data: BookingFormData,
): Pick<CreateSessionBody, 'title' | 'description' | 'start_time' | 'end_time' | 'room_id' | 'speaker_id' | 'speaker_name' | 'color'> {
  const endDate = data.end_date || data.date;
  return {
    title: data.title,
    description: data.description,
    start_time: `${data.date} ${data.start_time}:00`,
    end_time: `${endDate} ${data.end_time}:00`,
    room_id: data.room_id,
    speaker_id: data.speaker_id,
    speaker_name: data.speaker_name,
    color: data.color,
  };
}

/** Dátum + HH:mm → helyi Date objektum */
function toRange(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

/** Terem buffer szabály: minimum 2 óra két foglalás között */
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Van-e terem ütközés (átfedés vagy 2 órán belüli buffer) a megadott űrlappal.
 * @param sessions - Összes meglévő session
 * @param data - Új/szerkesztett foglalás
 * @param excludeSessionId - Szerkesztésnél kihagyandó session ID
 * @returns true, ha ütközés van
 */
export function hasRoomConflict(
  sessions: Session[],
  data: BookingFormData,
  excludeSessionId?: number,
): boolean {
  const endDate = data.end_date || data.date;
  const newStart = toRange(data.date, data.start_time);
  const newEnd = toRange(endDate, data.end_time);

  return sessions.some((s) => {
    if (excludeSessionId != null && s.id === excludeSessionId) return false;
    if (s.room_id !== data.room_id) return false;
    const sEnd = s.end_date ?? s.date;
    const existingStart = toRange(s.date, s.start_time);
    const existingEnd = toRange(sEnd, s.end_time);
    // 2 órás buffer után nincs ütközés
    if (newStart.getTime() >= existingEnd.getTime() + TWO_HOURS_MS) return false;
    if (existingStart.getTime() >= newEnd.getTime() + TWO_HOURS_MS) return false;
    return true;
  });
}

/**
 * Időtartomány validáció az űrlapon.
 * @param data - BookingFormData
 * @returns 'endBeforeStart' | 'invalidRange' | null (null = OK)
 */
export function validateBookingTimes(data: BookingFormData): 'endBeforeStart' | 'invalidRange' | null {
  const endDate = data.end_date || data.date;
  if (endDate < data.date) return 'endBeforeStart';
  const start = toRange(data.date, data.start_time);
  const end = toRange(endDate, data.end_time);
  if (end.getTime() <= start.getTime()) return 'invalidRange';
  return null;
}

/**
 * Foglalás hossza percekben.
 * @param data - BookingFormData
 * @returns Percek száma; 0 érvénytelen vagy nem pozitív tartománynál
 */
export function bookingDurationMinutes(data: BookingFormData): number {
  const endDate = data.end_date || data.date;
  const start = toRange(data.date, data.start_time);
  const end = toRange(endDate, data.end_time);
  const diff = (end.getTime() - start.getTime()) / 60000;
  return Number.isFinite(diff) && diff > 0 ? Math.round(diff) : 0;
}

/**
 * Foglalás napjainak száma (többnapos esetben).
 * @param data - BookingFormData
 */
export function bookingDayCount(data: BookingFormData): number {
  const end = data.end_date || data.date;
  if (end < data.date) return 0;
  return enumerateDateRange(data.date, end).length;
}

/**
 * Meglévő session hossza percekben.
 * @param session - Session idő mezőkkel
 */
export function sessionDurationMinutes(session: Session): number {
  const endDate = session.end_date ?? session.date;
  const start = toRange(session.date, session.start_time);
  const end = toRange(endDate, session.end_time);
  const diff = (end.getTime() - start.getTime()) / 60000;
  return Number.isFinite(diff) && diff > 0 ? Math.round(diff) : 0;
}

/**
 * Percek → emberi olvasható időtartam (pl. „1h 30m”, „2d 3h”).
 * @param minutes - Időtartam percekben
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h >= 24) {
    const days = Math.floor(h / 24);
    const rh = h % 24;
    if (rh && m) return `${days}d ${rh}h ${m}m`;
    if (rh) return `${days}d ${rh}h`;
    if (m) return `${days}d ${m}m`;
    return `${days}d`;
  }
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Két session időben átfed-e egymást.
 * @param a - Első session
 * @param b - Második session
 */
export function sessionsOverlap(a: Session, b: Session): boolean {
  const aStart = toRange(a.date, a.start_time);
  const aEnd = toRange(a.end_date ?? a.date, a.end_time);
  const bStart = toRange(b.date, b.start_time);
  const bEnd = toRange(b.end_date ?? b.date, b.end_time);
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Személyes program ütközések: mentett sessionök, amelyek átfednek a jelölttel.
 * @param saved - Felhasználó mentett sessionjei
 * @param candidate - Újonnan mentendő session
 */
export function findScheduleConflicts(saved: Session[], candidate: Session): Session[] {
  return saved.filter((s) => s.id !== candidate.id && sessionsOverlap(s, candidate));
}

/**
 * Session éppen „élő”-e (kezdődött, még nem ért véget, nem cancelled).
 * @param session - Ellenőrzendő session
 * @param now - Referencia időpont (teszteléshez)
 */
export function isSessionLive(session: Session, now = new Date()): boolean {
  if (isSessionCancelled(session)) return false;
  const start = toRange(session.date, session.start_time);
  const end = toRange(session.end_date ?? session.date, session.end_time);
  return now >= start && now <= end;
}

/** Foglalási ütközés előnézet kategóriák szerint */
export interface BookingConflictPreview {
  roomOverlap: Session[];
  roomBuffer: Session[];
  speakerOverlap: Session[];
}

/**
 * Űrlap adatokból ideiglenes Session objektum ütközés-ellenőrzéshez.
 * @param data - Űrlap
 * @param excludeSessionId - Szerkesztett session ID (vagy -1 új foglalásnál)
 */
export function bookingFormToCandidateSession(
  data: BookingFormData,
  excludeSessionId?: number,
): Session {
  const endDate = data.end_date || data.date;
  return {
    id: excludeSessionId ?? -1,
    title: data.title,
    description: data.description,
    date: data.date,
    end_date: endDate,
    start_time: data.start_time,
    end_time: data.end_time,
    room_id: data.room_id,
    speaker_id: data.speaker_id,
    room_name: data.room_name,
    speaker_name: data.speaker_name,
    color: data.color,
    status: 'scheduled',
  };
}

/** Terem buffer ütközés: átfedés VAGY 2 órán belüli közelség */
function hasBufferConflictBetween(
  a: { date: string; end_date?: string; start_time: string; end_time: string },
  b: { date: string; end_date?: string; start_time: string; end_time: string },
): boolean {
  if (sessionsOverlap(
    { ...a, end_date: a.end_date ?? a.date } as Session,
    { ...b, end_date: b.end_date ?? b.date } as Session,
  )) {
    return true;
  }
  const aStart = toRange(a.date, a.start_time);
  const aEnd = toRange(a.end_date ?? a.date, a.end_time);
  const bStart = toRange(b.date, b.start_time);
  const bEnd = toRange(b.end_date ?? b.date, b.end_time);
  if (aStart.getTime() >= bEnd.getTime() + TWO_HOURS_MS) return false;
  if (bStart.getTime() >= aEnd.getTime() + TWO_HOURS_MS) return false;
  return true;
}

/**
 * Részletes ütközés-ellenőrzés foglaláskor: terem átfedés, buffer, előadó átfedés.
 * @param sessions - Összes aktív session
 * @param data - Űrlap adatok
 * @param excludeSessionId - Szerkesztésnél kihagyandó ID
 * @returns BookingConflictPreview három listával
 */
export function findBookingConflicts(
  sessions: Session[],
  data: BookingFormData,
  excludeSessionId?: number,
): BookingConflictPreview {
  if (validateBookingTimes(data)) {
    return { roomOverlap: [], roomBuffer: [], speakerOverlap: [] };
  }

  const candidate = bookingFormToCandidateSession(data, excludeSessionId);
  const roomOverlap: Session[] = [];
  const roomBuffer: Session[] = [];
  const speakerOverlap: Session[] = [];

  for (const s of sessions) {
    if (excludeSessionId != null && s.id === excludeSessionId) continue;
    if (isSessionCancelled(s)) continue;

    if (s.room_id === data.room_id) {
      if (sessionsOverlap(s, candidate)) {
        roomOverlap.push(s);
      } else if (hasBufferConflictBetween(candidate, s)) {
        roomBuffer.push(s);
      }
    }

    if (
      data.speaker_id > 0 &&
      s.speaker_id === data.speaker_id &&
      sessionsOverlap(s, candidate)
    ) {
      speakerOverlap.push(s);
    }
  }

  return { roomOverlap, roomBuffer, speakerOverlap };
}

/**
 * Előre definiált session sablonok (típus, alapcím, időtartam, szín).
 * @remarks BookingModal sablon választóhoz
 */
export const SESSION_TEMPLATES: {
  id: SessionTemplateId;
  defaultTitle: string;
  durationMinutes: number;
  color: EventColor;
}[] = [
  { id: 'keynote', defaultTitle: 'Keynote', durationMinutes: 90, color: 'blue' },
  { id: 'panel', defaultTitle: 'Panel', durationMinutes: 60, color: 'amber' },
  { id: 'workshop', defaultTitle: 'Workshop', durationMinutes: 120, color: 'green' },
];

/** HH:mm + percek → új befejező idő (24 órán belül wrap) */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

/**
 * Sablon alkalmazása az űrlapra (cím, vége, szín).
 * @param form - Jelenlegi űrlap
 * @param templateId - Sablon azonosító
 * @param titlePrefix - Opcionális cím előtag (pl. eseménynév)
 * @returns Módosított BookingFormData; változatlan, ha ismeretlen sablon
 */
export function applySessionTemplate(
  form: BookingFormData,
  templateId: SessionTemplateId,
  titlePrefix?: string,
): BookingFormData {
  const tpl = SESSION_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return form;

  const end_time = addMinutesToTime(form.start_time, tpl.durationMinutes);
  const title =
    form.title.trim() && !SESSION_TEMPLATES.some((t) => t.defaultTitle === form.title.trim())
      ? form.title
      : titlePrefix
        ? `${titlePrefix}: ${tpl.defaultTitle}`
        : tpl.defaultTitle;

  return {
    ...form,
    title,
    end_date: form.date,
    end_time,
    color: tpl.color,
  };
}

/**
 * Session időtartomány megjelenítése (egy- vagy többnapos).
 * @param session - Session idő mezőkkel
 * @param locale - Nyelv (alapértelmezett: hu)
 */
export function formatSessionTimeRange(session: Session, locale: Locale = 'hu'): string {
  const start = formatTimeKey(session.start_time);
  const end = formatTimeKey(session.end_time);
  if (!isMultiDaySession(session)) {
    return `${start} – ${end}`;
  }
  return `${formatDateKey(session.date, locale)} ${start} – ${formatDateKey(session.end_date ?? session.date, locale)} ${end}`;
}
