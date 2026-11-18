'use client';

// Drive times between places, from /api/drive (OpenStreetMap routing), shared by the Stay and Golf maps.
import { useEffect, useState } from 'react';

export type Pt = { lat: number; lon: number };
type Table = { minutes: number[][] | null; miles: number[][] | null };
const tables = new Map<string, Promise<Table>>();
/** Drive times from each stay to each course (shared by every component asking the same question). */
export function useDriveTable(from: Pt[], to: Pt[]) {
  const enc = (ps: Pt[]) => ps.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join('|');
  const url = from.length && to.length ? `/api/drive?from=${enc(from)}&to=${enc(to)}` : '';
  const [res, setRes] = useState<{ url: string; t: Table } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    if (!tables.has(url)) tables.set(url, fetch(url).then((r) => (r.ok ? r.json() : { minutes: null, miles: null })).catch(() => ({ minutes: null, miles: null })));
    tables.get(url)!.then((t) => live && setRes({ url, t }));
    return () => { live = false; };
  }, [url]);
  return res && res.url === url ? res.t : null;
}

/** Without routing: miles on the road, at a typical 38 mph plus a few minutes for parking and lights. */
export const estMinutes = (mi: number) => Math.round((mi / 38) * 60 + 3);

/** "25 min", "1 hr 5 min". */
export const driveLabel = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} hr${min % 60 ? ` ${min % 60} min` : ''}`);

type Table2 = { minutes: number[][] | null; miles: number[][] | null } | null;
const straight = (a: Pt, b: Pt) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
};
/** One drive from the table (row i, column j), or an estimate from distance when routing isn't available. */
export function legOf(table: Table2, i: number, j: number, a: Pt, b: Pt): { min: number; mi: number; est: boolean } {
  const min = table?.minutes?.[i]?.[j], mi = table?.miles?.[i]?.[j];
  if (min && min > 0) return { min, mi: mi && mi > 0 ? mi : Math.max(1, Math.round(straight(a, b) * 1.25)), est: false };
  const road = Math.max(1, Math.round(straight(a, b) * 1.25));
  return { min: estMinutes(road), mi: road, est: true };
}
