import type { CreateSpeakerBody, Speaker, UpdateSpeakerBody } from '../../backend/types';
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

export function parseSpeaker(raw: unknown): Speaker | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = toNumber(row.id);
  const name = typeof row.name === 'string' ? row.name.trim() : '';
  if (!id || !name) return null;
  const bio =
    row.bio == null
      ? null
      : typeof row.bio === 'string'
        ? row.bio
        : String(row.bio);
  return {
    id,
    name,
    bio,
    session_count: row.session_count != null ? toNumber(row.session_count) : undefined,
  };
}

function parseSpeakersList(raw: unknown): Speaker[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(parseSpeaker)
    .filter((s): s is Speaker => s !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function speakersRequestError(
  res: Response,
  data: { message?: string },
  fallback: string,
): Error {
  if (res.status === 404) {
    return new Error('errors.speakersNotAvailable');
  }
  if (res.status === 409) {
    return new Error('errors.speakerDuplicate');
  }
  return new Error(data.message ?? fallback);
}

export async function fetchSpeakers(): Promise<Speaker[]> {
  const res = await authFetch('/api/speakers');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw speakersRequestError(res, data, 'errors.speakersLoadError');
  }
  return parseSpeakersList(await res.json());
}

export async function createSpeaker(body: CreateSpeakerBody): Promise<Speaker> {
  const res = await authFetch('/api/speakers', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw speakersRequestError(res, data, 'errors.speakersSaveError');
  }
  const speaker = parseSpeaker(await res.json());
  if (!speaker) throw new Error('errors.speakersSaveError');
  return speaker;
}

export async function updateSpeaker(id: number, body: UpdateSpeakerBody): Promise<Speaker> {
  const res = await authFetch(`/api/speakers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw speakersRequestError(res, data, 'errors.speakersSaveError');
  }
  const speaker = parseSpeaker(await res.json());
  if (!speaker) throw new Error('errors.speakersSaveError');
  return speaker;
}

export async function mergeSpeakers(
  keepId: number,
  mergeIds: number[],
): Promise<Speaker> {
  const res = await authFetch('/api/speakers/merge', {
    method: 'POST',
    body: JSON.stringify({ keep_id: keepId, merge_ids: mergeIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw speakersRequestError(res, data, 'errors.speakersSaveError');
  }
  const data = await res.json();
  const speaker = parseSpeaker(data.speaker);
  if (!speaker) throw new Error('errors.speakersSaveError');
  return speaker;
}

export async function deleteSpeaker(id: number): Promise<void> {
  const res = await authFetch(`/api/speakers/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new Error('errors.speakerNotFound');
    }
    throw new Error(data.message ?? 'errors.speakerDeleteError');
  }
}

export function speakersFromSessions(
  sessions: { speaker_id: number; speaker_name: string; speaker_bio?: string | null }[],
): Speaker[] {
  const map = new Map<number, { name: string; bio: string | null; count: number }>();
  for (const s of sessions) {
    const id = toNumber(s.speaker_id);
    const name = s.speaker_name?.trim();
    if (id > 0 && name) {
      const prev = map.get(id);
      if (prev) {
        prev.count += 1;
        if (!prev.bio && s.speaker_bio) prev.bio = s.speaker_bio;
      } else {
        map.set(id, {
          name,
          bio: s.speaker_bio ?? null,
          count: 1,
        });
      }
    }
  }
  return Array.from(map.entries())
    .map(([id, { name, bio, count }]) => ({
      id,
      name,
      bio,
      session_count: count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
