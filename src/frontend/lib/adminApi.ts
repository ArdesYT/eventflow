import type { ActivityLogEntry, BulkUpdateSessionsBody, User, UserRole } from '../../backend/types';
import { authFetch } from './authFetch';

export async function fetchAdminUsers(): Promise<User[]> {
  const res = await authFetch('/api/admin/users');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to load users.');
  }
  return res.json();
}

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

export async function deleteAdminUser(userId: number): Promise<void> {
  const res = await authFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to delete user.');
  }
}

export interface DemoSeedResult {
  sessionsInserted: number;
  invalidRemoved: number;
  totalSessions: number;
}

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

export async function fetchActivityLog(): Promise<ActivityLogEntry[]> {
  const res = await authFetch('/api/admin/activity-log');
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to load activity log.');
  }
  return res.json();
}

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
