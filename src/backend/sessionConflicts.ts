// Rooms need a two-hour gap; speakers cannot overlap. Cancelled sessions are ignored.
import type { Session } from './types';
import { formatDate, formatTime } from './datetime';

type SessionTimes = Pick<Session, 'date' | 'start_time' | 'end_time'> & { end_date?: string };
interface TimeRange { start: number; end: number }

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function timeRange(session: SessionTimes): TimeRange {
  return {
    start: new Date(`${session.date}T${formatTime(session.start_time)}:00`).getTime(),
    end: new Date(`${session.end_date ?? session.date}T${formatTime(session.end_time)}:00`).getTime(),
  };
}

function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

function rangesWithinBuffer(a: TimeRange, b: TimeRange): boolean {
  return !(a.start >= b.end + TWO_HOURS_MS || b.start >= a.end + TWO_HOURS_MS);
}

export function sessionsOverlap(a: SessionTimes, b: SessionTimes): boolean {
  return rangesOverlap(timeRange(a), timeRange(b));
}

/** Includes overlapping sessions as well as gaps shorter than two hours. */
export function hasBufferConflict(a: SessionTimes, b: SessionTimes): boolean {
  return rangesWithinBuffer(timeRange(a), timeRange(b));
}

/** Egy jelölt előadás ütközéseinek eredménye. */
export interface SessionConflictResult {
  roomOverlap: boolean;    // közvetlen terem-átfedés
  roomBuffer: boolean;     // 2 órás szabály sértése
  speakerOverlap: boolean; // előadó dupla foglalás
}

/**
 * Összes meglévő előadás ellen ellenőrzi a jelöltet.
 * @param existing — már DB-ben lévő előadások
 * @param candidate — új vagy szerkesztett (id opcionális: saját magát kihagyja)
 */
export function checkSessionConflicts(
  existing: Session[],
  candidate: SessionTimes & {
    id?: number;
    room_id: number;
    speaker_id: number;
    status?: string;
  },
): SessionConflictResult {
  const result: SessionConflictResult = {
    roomOverlap: false,
    roomBuffer: false,
    speakerOverlap: false,
  };

  const candidateRange = timeRange(candidate);

  for (const s of existing) {
    if (candidate.id != null && s.id === candidate.id) continue;
    if (s.status === 'cancelled') continue;

    const sameRoom = s.room_id === candidate.room_id;
    const sameSpeaker = candidate.speaker_id > 0 && s.speaker_id === candidate.speaker_id;
    if (!sameRoom && !sameSpeaker) continue;

    const otherRange = timeRange(s);
    const overlap = rangesOverlap(candidateRange, otherRange);
    if (sameRoom) {
      if (overlap) result.roomOverlap = true;
      else if (rangesWithinBuffer(candidateRange, otherRange)) result.roomBuffer = true;
    }

    if (sameSpeaker && overlap) result.speakerOverlap = true;
  }

  return result;
}

/**
 * Nyers SQL sor → frontend Session objektum.
 * Kezeli a MariaDB Date típusát és a datetime string formátumot.
 */
export function sessionFromRow(row: Record<string, unknown>): Session {
  return {
    id: Number(row.id),
    title: String(row.title),
    description: row.description != null ? String(row.description) : undefined,
    date: formatDate(row.start_time),
    end_date: formatDate(row.end_time),
    start_time: formatTime(row.start_time),
    end_time: formatTime(row.end_time),
    room_id: Number(row.room_id),
    speaker_id: Number(row.speaker_id),
    room_name: String(row.room_name ?? ''),
    speaker_name: String(row.speaker_name ?? ''),
    color: (row.color as Session['color']) ?? 'blue',
    status: String(row.status ?? 'scheduled').toLowerCase() === 'cancelled' ? 'cancelled' : 'scheduled',
  };
}
