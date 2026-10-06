import type { EventColor } from '../../backend/types';

export const SESSION_ACCENTS: Record<EventColor, string> = {
  blue: '#1a56db',
  amber: '#f59e0b',
  green: '#057a55',
  red: '#e02424',
};

export function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase();
}
