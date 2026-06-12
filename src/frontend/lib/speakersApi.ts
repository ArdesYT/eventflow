import type { Speaker } from '../../backend/types';
import { authFetch } from './authFetch';

export async function fetchSpeakers(): Promise<Speaker[]> {
  const res = await authFetch('/api/speakers');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to load speakers.');
  }
  return res.json();
}

export function speakersFromSessions(
  sessions: { speaker_id: number; speaker_name: string }[],
): Speaker[] {
  const map = new Map<number, string>();
  sessions.forEach((s) => {
    if (s.speaker_id && s.speaker_name) {
      map.set(s.speaker_id, s.speaker_name);
    }
  });
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
