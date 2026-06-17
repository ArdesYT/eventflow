/**
 * API alap URL és útvonal-építő segédfüggvények.
 *
 * Mit csinál: a backend hívásokhoz szükséges bázis URL-t és teljes API útvonalat állít elő.
 * Ki használja: authFetch, eventApi, roomsApi és minden modul, ami fetch-et indít.
 * Fő exportok: {@link API_BASE}, {@link apiUrl}.
 */

/**
 * A fetch hívások alap URL-je.
 * - Fejlesztés (Vite :5173): üresen hagyva — a kérések /api-ra mennek, a Vite proxyzza :3000-re.
 * - Közvetlen backend: állítsd be a .env-ben: VITE_API_URL=http://localhost:3000
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/**
 * Relatív API útvonalból teljes URL-t készít.
 * @param path - API végpont (pl. `/api/event` vagy `api/event`)
 * @returns Teljes URL, ha van API_BASE; egyébként relatív útvonal (Vite proxyhoz)
 * @example apiUrl('/api/rooms') → 'http://localhost:3000/api/rooms' vagy '/api/rooms'
 */
export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}
