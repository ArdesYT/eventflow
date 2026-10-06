import type { Session, SessionSaveUser, SessionSavesMap } from '../../backend/types';
import { authRequest } from './authFetch';
import { toNumber } from './parseNumber';

const SCHEDULE_ERRORS = { 404: 'errors.scheduleNotAvailable' };

function parseSessionSaveUser(raw: unknown): SessionSaveUser | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = toNumber(row.id);
  const name = typeof row.name === 'string' ? row.name : '';
  if (!id || !name) return null;
  return { id, name, email: String(row.email ?? '') };
}

function parseSessionSavesMap(raw: Record<string, unknown>): SessionSavesMap {
  const map: SessionSavesMap = {};
  for (const [key, value] of Object.entries(raw)) {
    const sessionId = toNumber(key);
    if (!sessionId || !Array.isArray(value)) continue;
    map[sessionId] = value.map(parseSessionSaveUser).filter((user) => user !== null);
  }
  return map;
}

export async function fetchMySchedule(): Promise<Session[]> {
  const res = await authRequest('/api/my-schedule', 'Failed to load saved programme.', {}, SCHEDULE_ERRORS);
  return res.json();
}

export async function addToMySchedule(sessionId: number): Promise<void> {
  await authRequest(`/api/my-schedule/${sessionId}`, 'Failed to save session.', { method: 'POST' }, SCHEDULE_ERRORS);
}

export async function removeFromMySchedule(sessionId: number): Promise<void> {
  await authRequest(`/api/my-schedule/${sessionId}`, 'Failed to remove session.', { method: 'DELETE' }, SCHEDULE_ERRORS);
}

export async function fetchSessionSaves(): Promise<SessionSavesMap> {
  const res = await authRequest('/api/sessions/saves', 'Failed to load session saves.', {}, {
    404: 'errors.savesNotAvailable',
  });
  return parseSessionSavesMap(await res.json());
}
