const KEY_PREFIX = 'eventflow_schedule_';

export function loadOfflineSchedule(userId: number): number[] {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is number => typeof id === 'number');
  } catch {
    return [];
  }
}

export function saveOfflineSchedule(userId: number, sessionIds: number[]): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${userId}`, JSON.stringify(sessionIds));
  } catch {
    /* ignore */
  }
}
