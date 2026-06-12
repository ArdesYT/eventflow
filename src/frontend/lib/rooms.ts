import type { Room } from '../../backend/types';

export const FALLBACK_ROOMS: Room[] = [
  { id: 1, name: 'Main Hall' },
  { id: 2, name: 'Room A' },
  { id: 3, name: 'Room B' },
  { id: 4, name: 'Workshop' },
  { id: 5, name: 'Outdoor Stage' },
];

/** @deprecated use FALLBACK_ROOMS or API rooms */
export const ROOMS = [
  { id: 1, key: 'mainHall' },
  { id: 2, key: 'roomA' },
  { id: 3, key: 'roomB' },
  { id: 4, key: 'workshop' },
  { id: 5, key: 'outdoorStage' },
] as const;

export function roomLabel(room: Room, t: (key: string) => string): string {
  const legacy = ROOMS.find((r) => r.id === room.id);
  return legacy ? t(`rooms.${legacy.key}`) : room.name;
}
