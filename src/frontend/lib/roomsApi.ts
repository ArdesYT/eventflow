/**
 * Termek (rooms) API — nyilvános lista lekérése.
 *
 * Mit csinál: a backend /api/rooms végpontját hívja hitelesítés nélkül.
 * Ki használja: App, CalendarView, BookingModal, admin nézetek (RoomsUsage).
 * Fő exportok: {@link fetchRooms}.
 */

import type { Room } from '../../backend/types';
import { apiUrl } from './api';

/**
 * Összes terem listázása a szerverről.
 * @returns Room tömb (id, name, …)
 * @throws Error, ha a betöltés sikertelen
 */
export async function fetchRooms(): Promise<Room[]> {
  const res = await fetch(apiUrl('/api/rooms'));
  if (!res.ok) throw new Error('Failed to load rooms');
  return res.json();
}
