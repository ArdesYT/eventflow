import { apiUrl } from './api';
import { loadAuthToken } from './authStorage';

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

export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = authHeaders(init.headers as HeadersInit);
  return fetch(apiUrl(path), { ...init, headers });
}
