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

function toRange(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

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
    if (newStart.getTime() >= existingEnd.getTime() + TWO_HOURS_MS) return false;
    if (existingStart.getTime() >= newEnd.getTime() + TWO_HOURS_MS) return false;
    return true;
  });
}

export function validateBookingTimes(data: BookingFormData): 'endBeforeStart' | 'invalidRange' | null {
  const endDate = data.end_date || data.date;
  if (endDate < data.date) return 'endBeforeStart';
  const start = toRange(data.date, data.start_time);
  const end = toRange(endDate, data.end_time);
  if (end.getTime() <= start.getTime()) return 'invalidRange';
  return null;
}

export function bookingDurationMinutes(data: BookingFormData): number {
  const endDate = data.end_date || data.date;
  const start = toRange(data.date, data.start_time);
  const end = toRange(endDate, data.end_time);
  const diff = (end.getTime() - start.getTime()) / 60000;
  return Number.isFinite(diff) && diff > 0 ? Math.round(diff) : 0;
}

export function bookingDayCount(data: BookingFormData): number {
  const end = data.end_date || data.date;
  if (end < data.date) return 0;
  return enumerateDateRange(data.date, end).length;
}

export function sessionDurationMinutes(session: Session): number {
  const endDate = session.end_date ?? session.date;
  const start = toRange(session.date, session.start_time);
  const end = toRange(endDate, session.end_time);
  const diff = (end.getTime() - start.getTime()) / 60000;
  return Number.isFinite(diff) && diff > 0 ? Math.round(diff) : 0;
}

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

export function sessionsOverlap(a: Session, b: Session): boolean {
  const aStart = toRange(a.date, a.start_time);
  const aEnd = toRange(a.end_date ?? a.date, a.end_time);
  const bStart = toRange(b.date, b.start_time);
  const bEnd = toRange(b.end_date ?? b.date, b.end_time);
  return aStart < bEnd && bStart < aEnd;
}

export function findScheduleConflicts(saved: Session[], candidate: Session): Session[] {
  return saved.filter((s) => s.id !== candidate.id && sessionsOverlap(s, candidate));
}

export function isSessionLive(session: Session, now = new Date()): boolean {
  if (isSessionCancelled(session)) return false;
  const start = toRange(session.date, session.start_time);
  const end = toRange(session.end_date ?? session.date, session.end_time);
  return now >= start && now <= end;
}

export interface BookingConflictPreview {
  roomOverlap: Session[];
  roomBuffer: Session[];
  speakerOverlap: Session[];
}

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

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

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

export function formatSessionTimeRange(session: Session, locale: Locale = 'hu'): string {
  const start = formatTimeKey(session.start_time);
  const end = formatTimeKey(session.end_time);
  if (!isMultiDaySession(session)) {
    return `${start} – ${end}`;
  }
  return `${formatDateKey(session.date, locale)} ${start} – ${formatDateKey(session.end_date ?? session.date, locale)} ${end}`;
}
