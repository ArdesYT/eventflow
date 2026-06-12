import type { EventProfile } from '../../backend/types';
import { authFetch } from './authFetch';
import { apiUrl } from './api';

export async function fetchActiveEvent(): Promise<EventProfile> {
  const res = await fetch(apiUrl('/api/event'));
  if (!res.ok) throw new Error('Failed to load event');
  return res.json();
}

export async function updateEventProfile(body: Partial<EventProfile>): Promise<EventProfile> {
  const res = await authFetch('/api/admin/event', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to update event');
  }
  return res.json();
}
