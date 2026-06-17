/**
 * Előadó duplikátumok felismerése név alapján.
 *
 * Mit csinál: normalizálja a neveket és csoportosítja az azonosnak tekintett előadókat.
 * Ki használja: SpeakersView (admin egyesítés UI).
 * Fő exportok: {@link normalizeSpeakerName}, {@link groupDuplicateSpeakers}.
 */

import type { Speaker } from '../../backend/types';

/**
 * Előadónév összehasonlításhoz: trim, kisbetű, többszörös szóköz egyesítése.
 * @param name - Nyers előadónév
 * @returns Normalizált kulcs string
 */
export function normalizeSpeakerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Duplikált előadók csoportosítása normalizált név szerint.
 * @param speakers - Teljes előadólista
 * @returns Csak azok a csoportok, ahol legalább 2 előadó van; session_count szerint rendezve
 * @remarks A „megtartandó” előadó általában a lista első eleme (legtöbb session)
 */
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
