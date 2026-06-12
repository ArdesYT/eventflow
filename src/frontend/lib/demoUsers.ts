import type { User } from '../../backend/types';

export type DemoUser = User & { password: string };

export const DEMO_USERS: DemoUser[] = [
  { id: 1, name: 'Admin', email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { id: 2, name: 'Booker', email: 'booker@example.com', password: 'booker123', role: 'booker', assigned_room_ids: [1, 2] },
  { id: 3, name: 'Attendee', email: 'attendee@example.com', password: 'attendee123', role: 'attendee' },
];

export function getDemoUser(role: User['role']): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.role === role);
}

export function getDemoUserByEmail(email: string): DemoUser | undefined {
  return DEMO_USERS.find((u) => u.email === email);
}
