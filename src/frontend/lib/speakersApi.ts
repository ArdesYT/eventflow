import type { CreateSpeakerBody, Speaker, UpdateSpeakerBody } from '../../backend/types';
import { authRequest } from './authFetch';
import { toNumber } from './parseNumber';

const SPEAKER_ERRORS = {
  404: 'errors.speakersNotAvailable',
  409: 'errors.speakerDuplicate',
};

export function parseSpeaker(raw: unknown): Speaker | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = toNumber(row.id);
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!id || !name) return null;
  return {
    id,
    name,
    bio: row.bio == null ? null : String(row.bio),
    session_count: row.session_count != null ? toNumber(row.session_count) : undefined,
  };
}

function requireSpeaker(raw: unknown): Speaker {
  const speaker = parseSpeaker(raw);
  if (!speaker) throw new Error('errors.speakersSaveError');
  return speaker;
}

export async function fetchSpeakers(): Promise<Speaker[]> {
  const res = await authRequest('/api/speakers', 'errors.speakersLoadError', {}, SPEAKER_ERRORS);
  const raw: unknown = await res.json();
  return Array.isArray(raw)
    ? raw.map(parseSpeaker).filter((speaker) => speaker !== null).sort((a, b) => a.name.localeCompare(b.name))
    : [];
}

export async function createSpeaker(body: CreateSpeakerBody): Promise<Speaker> {
  const res = await authRequest('/api/speakers', 'errors.speakersSaveError', {
    method: 'POST',
    body: JSON.stringify(body),
  }, SPEAKER_ERRORS);
  return requireSpeaker(await res.json());
}

export async function updateSpeaker(id: number, body: UpdateSpeakerBody): Promise<Speaker> {
  const res = await authRequest(`/api/speakers/${id}`, 'errors.speakersSaveError', {
    method: 'PATCH',
    body: JSON.stringify(body),
  }, SPEAKER_ERRORS);
  return requireSpeaker(await res.json());
}

export async function mergeSpeakers(keepId: number, mergeIds: number[]): Promise<Speaker> {
  const res = await authRequest('/api/speakers/merge', 'errors.speakersSaveError', {
    method: 'POST',
    body: JSON.stringify({ keep_id: keepId, merge_ids: mergeIds }),
  }, SPEAKER_ERRORS);
  const data = await res.json();
  return requireSpeaker(data.speaker);
}

export async function deleteSpeaker(id: number): Promise<void> {
  await authRequest(`/api/speakers/${id}`, 'errors.speakerDeleteError', { method: 'DELETE' }, {
    404: 'errors.speakerNotFound',
  });
}

/** Offline speaker catalog: count sessions and keep the first nonempty bio. */
export function speakersFromSessions(
  sessions: { speaker_id: number; speaker_name: string; speaker_bio?: string | null }[],
): Speaker[] {
  const map = new Map<number, { name: string; bio: string | null; count: number }>();
  for (const session of sessions) {
    const id = toNumber(session.speaker_id);
    const name = session.speaker_name?.trim();
    if (id <= 0 || !name) continue;
    const previous = map.get(id);
    if (previous) {
      previous.count += 1;
      if (!previous.bio && session.speaker_bio) previous.bio = session.speaker_bio;
    } else {
      map.set(id, { name, bio: session.speaker_bio ?? null, count: 1 });
    }
  }
  return [...map.entries()]
    .map(([id, { name, bio, count }]) => ({ id, name, bio, session_count: count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
