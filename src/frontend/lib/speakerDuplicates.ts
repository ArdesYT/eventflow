import type { Speaker } from '../../backend/types';

export function normalizeSpeakerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function groupDuplicateSpeakers(
  speakers: Speaker[],
): { key: string; speakers: Speaker[] }[] {
  const map = new Map<string, Speaker[]>();
  for (const s of speakers) {
    const key = normalizeSpeakerName(s.name);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({
      key,
      speakers: [...list].sort(
        (a, b) => (b.session_count ?? 0) - (a.session_count ?? 0) || a.id - b.id,
      ),
    }));
}
