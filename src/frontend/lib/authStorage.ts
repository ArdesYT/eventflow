/**
 * Hitelesítési adatok böngészős tárolása (localStorage).
 *
 * Mit csinál: bejelentkezett felhasználó és JWT token perzisztálása, betöltése, törlése.
 * Ki használja: LoginPage, App/Root (session visszaállítás), authFetch (token olvasás).
 * Fő exportok: {@link StoredAuth}, {@link loadStoredAuth}, {@link saveAuth}, {@link clearAuth}.
 */

import type { User } from '../../backend/types';

/** localStorage kulcs a felhasználói profil JSON-hoz */
const USER_KEY = 'eventflow_user';
/** localStorage kulcs a Bearer tokenhez */
const TOKEN_KEY = 'eventflow_token';

/** Betöltött hitelesítési állapot: felhasználó + opcionális token */
export interface StoredAuth {
  user: User;
  token: string | null;
}

/**
 * Visszaadja a localStorage-ból a mentett hitelesítést, ha érvényes.
 * @returns Felhasználó és token, vagy null (hiányzó/sérült adat, érvénytelen szerepkör)
 * @remarks A szerepkört normalizálja (kisbetű, trim); csak admin/booker/attendee fogadott el
 */
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

/**
 * Csak a mentett felhasználót adja vissza (token nélkül).
 * @returns User objektum vagy null
 */
export function loadStoredUser(): User | null {
  return loadStoredAuth()?.user ?? null;
}

/**
 * Csak a JWT tokent olvassa ki a localStorage-ból.
 * @returns Token string vagy null
 */
export function loadAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Felhasználót és tokent ment a localStorage-ba.
 * @param user - Bejelentkezett felhasználó adatai
 * @param token - JWT; null esetén a token kulcs törlődik
 */
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

/**
 * Felhasználó profil frissítése a meglévő token megtartásával.
 * @param user - Új user adat, vagy null → {@link clearAuth}
 */
export function saveStoredUser(user: User | null): void {
  if (user) {
    saveAuth(user, loadAuthToken());
  } else {
    clearAuth();
  }
}

/**
 * Törli a felhasználót és a tokent a localStorage-ból (kijelentkezés).
 */
export function clearAuth(): void {
  try {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}
