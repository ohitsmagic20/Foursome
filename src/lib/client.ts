'use client';

// Each person's secret token for a trip lives on their phone. No passwords.
const tokenKey = (code: string) => `foursome:token:${code}`;
const TRIPS_KEY = 'foursome:trips';

export function getToken(code: string): string | null {
  try { return localStorage.getItem(tokenKey(code)); } catch { return null; }
}
export function setToken(code: string, token: string) {
  try { localStorage.setItem(tokenKey(code), token); } catch { /* storage blocked */ }
}
export function clearToken(code: string) {
  try { localStorage.removeItem(tokenKey(code)); } catch { /* storage blocked */ }
}

export interface SavedTrip { code: string; name: string }
export function savedTrips(): SavedTrip[] {
  try { return JSON.parse(localStorage.getItem(TRIPS_KEY) || '[]'); } catch { return []; }
}
export function rememberTrip(code: string, name: string) {
  try {
    const list = savedTrips().filter((t) => t.code !== code);
    list.unshift({ code, name });
    localStorage.setItem(TRIPS_KEY, JSON.stringify(list.slice(0, 20)));
  } catch { /* storage blocked */ }
}

export async function api<T = unknown>(path: string, opts: { code?: string; body?: unknown; method?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = opts.code ? getToken(opts.code) : null;
  if (token) headers['x-member-token'] = token;
  const res = await fetch(path, {
    method: opts.method || (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status}).`);
  return json as T;
}

export const firstName = (n: string) => n.split(/\s+/)[0] || n;
export const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const todayLabel = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
