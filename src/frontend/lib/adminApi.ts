import type { User, UserRole } from '../../backend/types';
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
