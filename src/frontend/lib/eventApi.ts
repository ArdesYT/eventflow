/**
 * Eseményprofil API — nyilvános lekérés és admin szerkesztés.
 *
 * Mit csinál: az aktív esemény adatainak betöltése és admin PATCH frissítése.
 * Ki használja: PublicEventsPage, EventProfileEditor, App (esemény meta).
 * Fő exportok: {@link fetchActiveEvent}, {@link updateEventProfile}.
 */

import type { EventProfile } from '../../backend/types';
import { authRequest } from './authFetch';
import { apiUrl } from './api';

/**
 * Az aktív esemény profilját tölti le (nyilvános, auth nélkül).
 * @returns EventProfile a backendről
 * @throws Error, ha a válasz nem ok
 */
export async function fetchActiveEvent(): Promise<EventProfile> {
  const res = await fetch(apiUrl('/api/event'));
  if (!res.ok) throw new Error('Failed to load event');
  return res.json();
}

/**
 * Admin: eseményprofil részleges frissítése.
 * @param body - Csak a módosítandó mezők (Partial EventProfile)
 * @returns Frissített EventProfile
 * @throws Error a backend message mezőjével vagy általános hibával
 */
export async function updateEventProfile(body: Partial<EventProfile>): Promise<EventProfile> {
  const res = await authRequest('/api/admin/event', 'Failed to update event', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return res.json();
}
