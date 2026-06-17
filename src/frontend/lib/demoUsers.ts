/**
 * Demo bejelentkezési felhasználók (fejlesztés / bemutató).
 *
 * Mit csinál: előre definiált admin, booker, attendee fiókok jelszóval.
 * Ki használja: LoginPage (gyors demo belépés).
 * Fő exportok: {@link DemoUser}, {@link DEMO_USERS}, {@link getDemoUser}, {@link getDemoUserByEmail}.
 */

import type { User } from '../../backend/types';

/** User + plaintext jelszó (csak kliens oldali demo, nem production) */
export type DemoUser = User & { password: string };

/**
 * Előre kitöltött demo fiókok szerepkörönként.
 * @remarks A jelszavak csak helyi/demo célra szolgálnak
 */
export const DEMO_USERS: DemoUser[] = [
  { id: 1, name: 'Admin', email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { id: 2, name: 'Booker', email: 'booker@example.com', password: 'booker123', role: 'booker', assigned_room_ids: [1, 2] },
  { id: 3, name: 'Attendee', email: 'attendee@example.com', password: 'attendee123', role: 'attendee' },
];

/**
 * Első demo felhasználó adott szerepkörrel.
 * @param role - Keresett szerepkör
 * @returns DemoUser vagy undefined
 */
export function getDemoUser(role: User['role']): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.role === role);
}

/**
 * Demo felhasználó keresése email alapján.
 * @param email - Email cím (pontos egyezés)
 * @returns DemoUser vagy undefined
 */
export function getDemoUserByEmail(email: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.email === email);
}
