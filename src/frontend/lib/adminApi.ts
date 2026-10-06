import type { ActivityLogEntry, BulkUpdateSessionsBody, User, UserRole } from '../../backend/types';
import { authRequest } from './authFetch';

export async function fetchAdminUsers(): Promise<User[]> {
  const res = await authRequest('/api/admin/users', 'Failed to load users.');
  return res.json();
}

export async function updateUserRole(userId: number, role: UserRole): Promise<User> {
  const res = await authRequest(`/api/admin/users/${userId}`, 'Failed to update user.', {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  return res.json();
}

export async function deleteAdminUser(userId: number): Promise<void> {
  await authRequest(`/api/admin/users/${userId}`, 'Failed to delete user.', { method: 'DELETE' });
}

export interface DemoSeedResult {
  sessionsInserted: number;
  invalidRemoved: number;
  totalSessions: number;
}

export async function seedDemoData(force = false): Promise<DemoSeedResult> {
  const res = await authRequest('/api/admin/seed-demo', 'errors.seedFailed', {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
  return res.json();
}

export async function bulkUpdateSessions(body: BulkUpdateSessionsBody): Promise<{ updated: number }> {
  const res = await authRequest('/api/sessions/bulk', 'errors.saveError', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function updateUserRooms(userId: number, roomIds: number[]): Promise<User> {
  const res = await authRequest(`/api/admin/users/${userId}/rooms`, 'Failed to update rooms.', {
    method: 'PUT',
    body: JSON.stringify({ room_ids: roomIds }),
  });
  return res.json();
}

export async function fetchActivityLog(): Promise<ActivityLogEntry[]> {
  const res = await authRequest('/api/admin/activity-log', 'Failed to load activity log.');
  return res.json();
}

export async function setSessionStatus(
  sessionId: number,
  status: 'scheduled' | 'cancelled',
): Promise<void> {
  await authRequest(`/api/sessions/${sessionId}/status`, 'errors.saveError', {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
