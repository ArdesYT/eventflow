/**
 * Hitelesített HTTP kérések (fetch wrapper).
 *
 * Mit csinál: automatikusan hozzáadja a JSON Content-Type-ot és a Bearer tokent a fejlécekhez.
 * Ki használja: scheduleApi, adminApi, speakersApi, eventApi (admin végpontok).
 * Fő exportok: {@link authHeaders}, {@link authFetch}.
 */

import { apiUrl, ensureResponseOk } from './api';
import { loadAuthToken } from './authStorage';

/**
 * Alapértelmezett API fejlécek + opcionális Authorization Bearer token.
 * @param extra - További fejlécek (felülírhatják az alapértelmezetteket)
 * @returns HeadersInit objektum fetch-hez
 */
export function authHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = loadAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * fetch wrapper: teljes API URL + hitelesített fejlécek.
 * @param path - Relatív API útvonal (pl. `/api/my-schedule`)
 * @param init - Standard RequestInit (method, body, stb.)
 * @returns A nyers Response objektum (a hívó ellenőrzi az ok státuszt)
 */
export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = authHeaders(init.headers as HeadersInit);
  return fetch(apiUrl(path), { ...init, headers });
}

/** Authenticated request with consistent backend error handling. */
export async function authRequest(
  path: string,
  fallback: string,
  init: RequestInit = {},
  statusErrors: Partial<Record<number, string>> = {},
): Promise<Response> {
  const response = await authFetch(path, init);
  await ensureResponseOk(response, fallback, statusErrors);
  return response;
}
