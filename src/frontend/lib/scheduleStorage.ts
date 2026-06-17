/**
 * Offline személyes program tárolása localStorage-ban.
 *
 * Mit csinál: felhasználónként menti a kiválasztott session ID-kat, ha nincs backend/sync.
 * Ki használja: App, SessionsView (offline fallback a scheduleApi mellett).
 * Fő exportok: {@link loadOfflineSchedule}, {@link saveOfflineSchedule}.
 */

/** localStorage kulcs előtag: eventflow_schedule_{userId} */
const KEY_PREFIX = 'eventflow_schedule_';

/**
 * Betölti a felhasználó offline mentett programját (session ID lista).
 * @param userId - Bejelentkezett felhasználó azonosítója
 * @returns Szám típusú session ID-k tömbje; üres tömb hiba/hiány esetén
 */
export function loadOfflineSchedule(userId: number): number[] {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Csak szám ID-k maradnak — régi/sérült adatok kiszűrése
    return parsed.filter((id): id is number => typeof id === 'number');
  } catch {
    return [];
  }
}

/**
 * Elmenti a felhasználó offline programját.
 * @param userId - Felhasználó azonosító
 * @param sessionIds - Mentendő session ID-k
 */
export function saveOfflineSchedule(userId: number, sessionIds: number[]): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${userId}`, JSON.stringify(sessionIds));
  } catch {
    /* ignore */
  }
}
