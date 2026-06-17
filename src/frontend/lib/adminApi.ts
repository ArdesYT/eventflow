/**
 * Admin API — felhasználók, demo seed, bulk session, napló, státusz.
 *
 * Mit csinál: védett /api/admin/* és kapcsolódó admin műveletek hívása.
 * Ki használja: AdminApp, UsersView, ActivityLogView, BulkSessionToolbar, EventProfileEditor.
 * Fő exportok: {@link fetchAdminUsers}, {@link updateUserRole}, {@link seedDemoData}, {@link bulkUpdateSessions}, stb.
 */

import type { ActivityLogEntry, BulkUpdateSessionsBody, User, UserRole } from '../../backend/types';
import { authFetch } from './authFetch';

/**
 * Összes regisztrált felhasználó listázása.
 * @returns User tömb
 * @throws Error betöltési hiba esetén
 */
export async function fetchAdminUsers(): Promise<User[]> {
  const res = await authFetch('/api/admin/users');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to load users.');
  }
  return res.json();
}

/**
 * Felhasználó szerepkörének módosítása.
 * @param userId - Cél felhasználó ID
 * @param role - Új szerepkör (admin | booker | attendee)
 * @returns Frissített User
 */
export async function updateUserRole(userId: number, role: UserRole): Promise<User> {
  const res = await authFetch(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to update user.');
  }
  return res.json();
}

/**
 * Felhasználó végleges törlése.
 * @param userId - Törlendő felhasználó ID
 */
export async function deleteAdminUser(userId: number): Promise<void> {
  const res = await authFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to delete user.');
  }
}

/** Demo seed végpont válaszának struktúrája */
export interface DemoSeedResult {
  sessionsInserted: number;
  invalidRemoved: number;
  totalSessions: number;
}

/**
 * Demo adatok betöltése a szerverre (admin).
 * @param force - true: meglévő demo adatok felülírása
 * @returns Beszúrt/eltávolított session statisztika
 */
export async function seedDemoData(force = false): Promise<DemoSeedResult> {
  const res = await authFetch('/api/admin/seed-demo', {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'errors.seedFailed');
  }
  return res.json();
}

/**
 * Több session egyszerre módosítása (bulk PATCH).
 * @param body - BulkUpdateSessionsBody (session ID-k + mezők)
 * @returns Frissített rekordok száma
 */
export async function bulkUpdateSessions(body: BulkUpdateSessionsBody): Promise<{ updated: number }> {
  const res = await authFetch('/api/sessions/bulk', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'errors.saveError');
  }
  return res.json();
}

/**
 * Bookerhez rendelt termek frissítése.
 * @param userId - Booker felhasználó ID
 * @param roomIds - Hozzárendelendő terem ID-k
 * @returns Frissített User (assigned_room_ids)
 */
export async function updateUserRooms(userId: number, roomIds: number[]): Promise<User> {
  const res = await authFetch(`/api/admin/users/${userId}/rooms`, {
    method: 'PUT',
    body: JSON.stringify({ room_ids: roomIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to update rooms.');
  }
  return res.json();
}

/**
 * Admin aktivitási napló lekérése.
 * @returns ActivityLogEntry tömb időrendben
 */
export async function fetchActivityLog(): Promise<ActivityLogEntry[]> {
  const res = await authFetch('/api/admin/activity-log');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to load activity log.');
  }
  return res.json();
}

/**
 * Egy session státuszának beállítása (ütemezett / törölve).
 * @param sessionId - Session ID
 * @param status - 'scheduled' vagy 'cancelled'
 */
export async function setSessionStatus(
  sessionId: number,
  status: 'scheduled' | 'cancelled',
): Promise<void> {
  const res = await authFetch(`/api/sessions/${sessionId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'errors.saveError');
  }
}
