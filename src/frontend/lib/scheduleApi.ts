import type { Session, SessionSaveUser, SessionSavesMap } from '../../backend/types';
import { authFetch } from './authFetch';

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function parseSessionSaveUser(raw: unknown): SessionSaveUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = toNumber(row.id);
  const name = typeof row.name === 'string' ? row.name : '';
  if (!id || !name) return null;
  return {
    id,
    name,
    email: typeof row.email === 'string' ? row.email : String(row.email ?? ''),
  };
}

function parseSessionSavesMap(raw: Record<string, unknown>): SessionSavesMap {
  const map: SessionSavesMap = {};
  for (const [key, value] of Object.entries(raw)) {
    const sessionId = toNumber(key);
    if (!sessionId || !Array.isArray(value)) continue;
    map[sessionId] = value
      .map(parseSessionSaveUser)
      .filter((u): u is SessionSaveUser => u !== null);
  }
  return map;
}

function scheduleRequestError(
  res: Response,
  data: { message?: string },
  fallback: string,
): Error {
  if (res.status === 404) {
    return new Error('errors.scheduleNotAvailable');
  }
  return new Error(data.message ?? fallback);
}

export async function fetchMySchedule(): Promise<Session[]> {
  const res = await authFetch('/api/my-schedule');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw scheduleRequestError(res, data, 'Failed to load saved programme.');
  }
  return res.json();
}

export async function addToMySchedule(sessionId: number): Promise<void> {
  const res = await authFetch(`/api/my-schedule/${sessionId}`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw scheduleRequestError(res, data, 'Failed to save session.');
  }
}

export async function removeFromMySchedule(sessionId: number): Promise<void> {
  const res = await authFetch(`/api/my-schedule/${sessionId}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw scheduleRequestError(res, data, 'Failed to remove session.');
  }
}

export async function fetchSessionSaves(): Promise<SessionSavesMap> {
  const res = await authFetch('/api/sessions/saves');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new Error('errors.savesNotAvailable');
    }
    throw new Error(data.message ?? 'Failed to load session saves.');
  }
  const raw = (await res.json()) as Record<string, unknown>;
  return parseSessionSavesMap(raw);
}
