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

/** A trip remembered on this phone, with what we last saw of it (so the trip list can show dates and places). */
export interface SavedTrip {
  code: string; name: string;
  start?: string | null; nights?: number; destination?: string | null; members?: number;
  /** True when the dates or place are the current leader, not locked yet. */
  tentative?: boolean;
  /** When this phone last opened the trip (ms). */
  seen?: number;
}
export function savedTrips(): SavedTrip[] {
  try { return JSON.parse(localStorage.getItem(TRIPS_KEY) || '[]'); } catch { return []; }
}
export function rememberTrip(code: string, name: string, info: Omit<SavedTrip, 'code' | 'name' | 'seen'> = {}) {
  try {
    const list = savedTrips();
    const prev = list.find((t) => t.code === code);
    const next: SavedTrip = { ...prev, ...info, code, name, seen: Date.now() };
    localStorage.setItem(TRIPS_KEY, JSON.stringify([next, ...list.filter((t) => t.code !== code)].slice(0, 30)));
  } catch { /* storage blocked */ }
}

// Signed-in session for this phone (one per person, works across all their trips).
const SESSION_KEY = 'foursome:session';
export function getSession(): string | null {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}
export function setSession(token: string) {
  try { localStorage.setItem(SESSION_KEY, token); } catch { /* storage blocked */ }
}
export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* storage blocked */ }
}

export async function api<T = unknown>(path: string, opts: { code?: string; body?: unknown; method?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = opts.code ? getToken(opts.code) : null;
  if (token) headers['x-member-token'] = token;
  const session = getSession();
  if (session) headers['x-session'] = session;
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
