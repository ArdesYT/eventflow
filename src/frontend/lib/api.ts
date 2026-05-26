/**
 * API base URL for fetch calls.
 * - Dev (Vite on :5173): leave empty — requests go to /api and Vite proxies to :3000.
 * - Direct backend: set VITE_API_URL=http://localhost:3000 in .env
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}
