/**
 * Böngészős értesítések — session kezdet előtti emlékeztető.
 *
 * Mit csinál: 15 perccel a kezdés előtt Notification API; localStorage deduplikáció.
 * Ki használja: App (syncSessionNotifications mount/unmount).
 * Fő exportok: {@link notificationsEnabled}, {@link syncSessionNotifications}, {@link requestNotificationPermission}.
 */

import type { Session } from '../../backend/types';
import { isSessionCancelled } from './sessionFormat';

/** Értesítés lead time: 15 perc a kezdés előtt */
const LEAD_MS = 15 * 60 * 1000;
/** Már kiküldött értesítések kulcsai (localStorage) */
const STORAGE_KEY = 'eventflow_notified';
/** Felhasználó be/kikapcsolta-e az értesítéseket */
const ENABLED_KEY = 'eventflow_notifications_enabled';

let checkInterval: ReturnType<typeof setInterval> | null = null;
let notifyFn: ((key: string, params?: Record<string, string | number>) => string) | null = null;

/** Betölti a már értesített session kulcsok halmazát */
function notifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

/** Megjelöli a kulcsot értesítettként; max ~200 elem tárolása */
function markNotified(key: string) {
  const set = notifiedIds();
  set.add(key);
  const arr = [...set].slice(-200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

/** Egyedi kulcs: session id + dátum + kezdő idő (újraszámolás duplikátum ellen) */
function sessionNotifyKey(session: Session): string {
  return `${session.id}:${session.date}:${session.start_time}`;
}

/** Session kezdő Date objektuma */
function parseStart(session: Session): Date | null {
  const t = String(session.start_time).match(/(\d{2}:\d{2})/)?.[1] ?? session.start_time;
  const d = new Date(`${session.date}T${t}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Értesítések be vannak-e kapcsolva a felhasználó által.
 * @returns true, ha localStorage ENABLED_KEY === '1'
 */
export function notificationsEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1';
}

/**
 * Felhasználói beállítás: értesítések engedélyezése/tiltása.
 * @param on - true = bekapcsolva
 */
export function setNotificationsEnabled(on: boolean) {
  localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
}

/**
 * Böngésző Notification engedély kérése.
 * @returns 'granted' | 'denied' | 'default' | 'unsupported'
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

/** Egy sessionhez tartozó értesítés kiküldése, ha az ablakban van */
function fireNotification(session: Session) {
  if (!notifyFn || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const key = sessionNotifyKey(session);
  if (notifiedIds().has(key)) return;

  const start = parseStart(session);
  if (!start) return;

  const now = Date.now();
  const diff = start.getTime() - now;
  // Lead ablak: 15 perc előtt … 5 perc után is (késve is egyszer jelez)
  if (diff > LEAD_MS || diff < -5 * 60 * 1000) return;

  markNotified(key);
  new Notification(notifyFn('public.notificationTitle'), {
    body: notifyFn('public.notificationBody', { title: session.title, room: session.room_name }),
    tag: key,
  });
}

/** Összes releváns session ellenőrzése értesítésre */
function checkSessions(sessions: Session[]) {
  if (!notificationsEnabled()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  for (const s of sessions) {
    if (isSessionCancelled(s)) continue;
    fireNotification(s);
  }
}

/**
 * Értesítési ciklus indítása/frissítése: azonnali ellenőrzés + percenkénti interval.
 * @param sessions - Aktuális session lista (pl. személyes program)
 * @param t - i18n fordító függvény értesítés szöveghez
 */
export function syncSessionNotifications(
  sessions: Session[],
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  notifyFn = t;
  checkSessions(sessions);

  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(() => checkSessions(sessions), 60_000);
}

/**
 * Értesítési interval leállítása (pl. komponens unmount).
 */
export function stopSessionNotifications() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  notifyFn = null;
}
