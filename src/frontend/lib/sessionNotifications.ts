import type { Session } from '../../backend/types';
import { isSessionCancelled } from './sessionFormat';

const LEAD_MS = 15 * 60 * 1000;
const STORAGE_KEY = 'eventflow_notified';
const ENABLED_KEY = 'eventflow_notifications_enabled';

let checkInterval: ReturnType<typeof setInterval> | null = null;
let notifyFn: ((key: string, params?: Record<string, string | number>) => string) | null = null;

function notifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function markNotified(key: string) {
  const set = notifiedIds();
  set.add(key);
  const arr = [...set].slice(-200);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function sessionNotifyKey(session: Session): string {
  return `${session.id}:${session.date}:${session.start_time}`;
}

function parseStart(session: Session): Date | null {
  const t = String(session.start_time).match(/(\d{2}:\d{2})/)?.[1] ?? session.start_time;
  const d = new Date(`${session.date}T${t}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function notificationsEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1';
}

export function setNotificationsEnabled(on: boolean) {
  localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

function fireNotification(session: Session) {
  if (!notifyFn || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;

  const key = sessionNotifyKey(session);
  if (notifiedIds().has(key)) return;

  const start = parseStart(session);
  if (!start) return;

  const now = Date.now();
  const diff = start.getTime() - now;
  if (diff > LEAD_MS || diff < -5 * 60 * 1000) return;

  markNotified(key);
  new Notification(notifyFn('public.notificationTitle'), {
    body: notifyFn('public.notificationBody', { title: session.title, room: session.room_name }),
    tag: key,
  });
}

function checkSessions(sessions: Session[]) {
  if (!notificationsEnabled()) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  for (const s of sessions) {
    if (isSessionCancelled(s)) continue;
    fireNotification(s);
  }
}

export function syncSessionNotifications(
  sessions: Session[],
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  notifyFn = t;
  checkSessions(sessions);

  if (checkInterval) clearInterval(checkInterval);
  checkInterval = setInterval(() => checkSessions(sessions), 60_000);
}

export function stopSessionNotifications() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  notifyFn = null;
}
