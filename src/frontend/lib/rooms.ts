/**
 * Termek megjelenítése — fallback lista és lokalizált címkék.
 *
 * Mit csinál: alapértelmezett termek, ha az API nem elérhető; fordítási kulcsok régi ID-khez.
 * Ki használja: CalendarView, BookingModal, SessionsView, AgendaView.
 * Fő exportok: {@link FALLBACK_ROOMS}, {@link ROOMS}, {@link roomLabel}.
 */

import type { Room } from '../../backend/types';

/**
 * Alapértelmezett termek, ha a rooms API nem válaszol (demo/offline).
 * @remarks Az ID-k egyeznek a demo seed és a régi ROOMS konstans értékeivel
 */
export const FALLBACK_ROOMS: Room[] = [
  { id: 1, name: 'Main Hall' },
  { id: 2, name: 'Room A' },
  { id: 3, name: 'Room B' },
  { id: 4, name: 'Workshop' },
  { id: 5, name: 'Outdoor Stage' },
];

/**
 * Régi i18n kulcs alapú terem lista (ID → fordítási kulcs).
 * @deprecated Használd a {@link FALLBACK_ROOMS}-ot vagy az API-ból jövő Room objektumokat
 */
export const ROOMS = [
  { id: 1, key: 'mainHall' },
  { id: 2, key: 'roomA' },
  { id: 3, key: 'roomB' },
  { id: 4, key: 'workshop' },
  { id: 5, key: 'outdoorStage' },
] as const;

/**
 * Terem megjelenítendő neve: ismert ID → i18n, egyébként a szerver neve.
 * @param room - Room objektum (API vagy fallback)
 * @param t - Fordító függvény (pl. useTranslation t)
 * @returns Lokalizált vagy nyers teremnév
 */
export function roomLabel(room: Room, t: (key: string) => string): string {
  const legacy = ROOMS.find((r) => r.id === room.id);
  return legacy ? t(`rooms.${legacy.key}`) : room.name;
}
