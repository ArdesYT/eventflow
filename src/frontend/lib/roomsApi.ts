import type { Room } from '../../backend/types';
import { apiUrl } from './api';

export async function fetchRooms(): Promise<Room[]> {
  const res = await fetch(apiUrl('/api/rooms'));
  if (!res.ok) throw new Error('Failed to load rooms');
  return res.json();
}
