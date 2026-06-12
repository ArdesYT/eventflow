import type { Session } from './types';

function toRange(date: string, time: string): Date {
  const t = String(time).match(/(\d{2}:\d{2})/)?.[1] ?? time;
  return new Date(`${date}T${t}:00`);
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function sessionsOverlap(
  a: { date: string; end_date?: string; start_time: string; end_time: string },
  b: { date: string; end_date?: string; start_time: string; end_time: string },
): boolean {
  const aStart = toRange(a.date, a.start_time);
  const aEnd = toRange(a.end_date ?? a.date, a.end_time);
  const bStart = toRange(b.date, b.start_time);
  const bEnd = toRange(b.end_date ?? b.date, b.end_time);
  return aStart < bEnd && bStart < aEnd;
}

export function hasBufferConflict(
  a: { date: string; end_date?: string; start_time: string; end_time: string },
  b: { date: string; end_date?: string; start_time: string; end_time: string },
): boolean {
  if (!sessionsOverlap(a, b)) {
    const aStart = toRange(a.date, a.start_time);
    const aEnd = toRange(a.end_date ?? a.date, a.end_time);
    const bStart = toRange(b.date, b.start_time);
    const bEnd = toRange(b.end_date ?? b.date, b.end_time);
    if (aStart.getTime() >= bEnd.getTime() + TWO_HOURS_MS) return false;
    if (bStart.getTime() >= aEnd.getTime() + TWO_HOURS_MS) return false;
    return true;
  }
  return true;
}

export interface SessionConflictResult {
  roomOverlap: boolean;
  roomBuffer: boolean;
  speakerOverlap: boolean;
}

export function checkSessionConflicts(
  existing: Session[],
  candidate: {
    id?: number;
    room_id: number;
    speaker_id: number;
    date: string;
    end_date?: string;
    start_time: string;
    end_time: string;
    status?: string;
  },
): SessionConflictResult {
  const result: SessionConflictResult = {
    roomOverlap: false,
    roomBuffer: false,
    speakerOverlap: false,
  };

  const cand = {
    date: candidate.date,
    end_date: candidate.end_date ?? candidate.date,
    start_time: candidate.start_time,
    end_time: candidate.end_time,
  };

  for (const s of existing) {
    if (candidate.id != null && s.id === candidate.id) continue;
    if (s.status === 'cancelled') continue;

    const other = {
      date: s.date,
      end_date: s.end_date ?? s.date,
      start_time: s.start_time,
      end_time: s.end_time,
    };

    if (s.room_id === candidate.room_id) {
      if (sessionsOverlap(cand, other)) result.roomOverlap = true;
      else if (hasBufferConflict(cand, other)) result.roomBuffer = true;
    }

    if (
      candidate.speaker_id > 0 &&
      s.speaker_id === candidate.speaker_id &&
      sessionsOverlap(cand, other)
    ) {
      result.speakerOverlap = true;
    }
  }

  return result;
}

export function sessionFromRow(row: Record<string, unknown>): Session {
  const start = row.start_time instanceof Date
    ? row.start_time
    : String(row.start_time);
  const end = row.end_time instanceof Date ? row.end_time : String(row.end_time);
  const date = start instanceof Date
    ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
    : String(start).slice(0, 10);
  const endDate = end instanceof Date
    ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    : String(end).slice(0, 10);
  const parseTime = (v: string | Date) => {
    if (v instanceof Date) {
      return `${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}`;
    }
    return String(v).match(/(\d{2}:\d{2})/)?.[1] ?? String(v);
  };
  return {
    id: Number(row.id),
    title: String(row.title),
    description: row.description != null ? String(row.description) : undefined,
    date,
    end_date: endDate,
    start_time: parseTime(start as string | Date),
    end_time: parseTime(end as string | Date),
    room_id: Number(row.room_id),
    speaker_id: Number(row.speaker_id),
    room_name: String(row.room_name ?? ''),
    speaker_name: String(row.speaker_name ?? ''),
    color: (row.color as Session['color']) ?? 'blue',
    status: String(row.status ?? 'scheduled').toLowerCase() === 'cancelled' ? 'cancelled' : 'scheduled',
  };
}
