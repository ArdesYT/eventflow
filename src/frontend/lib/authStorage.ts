import type { User } from '../../backend/types';

const USER_KEY = 'eventflow_user';
const TOKEN_KEY = 'eventflow_token';

export interface StoredAuth {
  user: User;
  token: string | null;
}

export function loadStoredAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as User;
    if (!parsed?.id || !parsed?.email || !parsed?.role) return null;

    const role = parsed.role.trim().toLowerCase();
    if (role !== 'admin' && role !== 'booker' && role !== 'attendee') return null;

    const token = localStorage.getItem(TOKEN_KEY);
    return {
      user: { ...parsed, role: role as User['role'] },
      token,
    };
  } catch {
    return null;
  }
}

export function loadStoredUser(): User | null {
  return loadStoredAuth()?.user ?? null;
}

export function loadAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveAuth(user: User, token: string | null): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function saveStoredUser(user: User | null): void {
  if (user) {
    saveAuth(user, loadAuthToken());
  } else {
    clearAuth();
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
