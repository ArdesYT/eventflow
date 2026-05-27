import type { User, UserRole } from '../../backend/types';
import { apiUrl } from './api';

function adminHeaders(userId: number): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-User-Id': String(userId),
  };
}

export async function fetchAdminUsers(adminId: number): Promise<User[]> {
  const res = await fetch(apiUrl('/api/admin/users'), {
    headers: adminHeaders(adminId),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to load users.');
  }
  return res.json();
}

export async function updateUserRole(
  adminId: number,
  userId: number,
  role: UserRole,
): Promise<User> {
  const res = await fetch(apiUrl(`/api/admin/users/${userId}`), {
    method: 'PATCH',
    headers: adminHeaders(adminId),
    body: JSON.stringify({ role }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to update user.');
  }
  return res.json();
}

export async function deleteAdminUser(adminId: number, userId: number): Promise<void> {
  const res = await fetch(apiUrl(`/api/admin/users/${userId}`), {
    method: 'DELETE',
    headers: adminHeaders(adminId),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to delete user.');
  }
}
