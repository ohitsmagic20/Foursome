import RESORTS_JSON from '@/data/resorts.json';
import COORDS from '@/data/package-coords.json';
import { PACKAGES, type StayPlay } from '@/data/packages';
import { miles } from './geo';

// Every US golf resort we've catalogued (from GolfPass's state-by-state resort directories, Golf Digest's
// best golf resorts and the golftrips.com package directory, Nov 2026), with the nearest town's coordinates.
// Nearly all sell some form of stay and play; the priced, published packages live in data/packages.ts.

export interface Resort { resort: string; city: string; state: string; courses: string[]; lat: number; lon: number }
export const RESORTS = RESORTS_JSON as Resort[];
const PKG_AT = COORDS as unknown as Record<string, [number, number]>;

export const resortSearchUrl = (r: Pick<Resort, 'resort' | 'city' | 'state'>) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${r.resort} ${r.city} ${r.state} stay and play golf package`)}`;

const key = (s: string) => s.toLowerCase().replace(/^the /, '').replace(/[^a-z0-9 ]/g, '').split(' ').slice(0, 2).join(' ');

export type Near<T> = T & { miles: number };

/** Packages and resorts within `radius` miles of a point (wider if there's almost nothing close). */
export function nearby(lat: number, lon: number, radius = 75): { packages: Near<StayPlay>[]; resorts: Near<Resort>[] } {
  const pick = (r: number) => {
    const packages = PACKAGES.filter((p) => PKG_AT[p.id])
      .map((p) => ({ ...p, miles: Math.round(miles(lat, lon, PKG_AT[p.id][0], PKG_AT[p.id][1])) }))
      .filter((p) => p.miles <= r)
      .sort((a, b) => a.miles - b.miles);
    // Skip a resort already shown as a package: same name start, same state, within a few miles.
    const shown = (x: Resort) => packages.some((p) => p.state === x.state && key(p.resort) === key(x.resort) && miles(x.lat, x.lon, PKG_AT[p.id][0], PKG_AT[p.id][1]) < 5);
    const resorts = RESORTS.map((x) => ({ ...x, miles: Math.round(miles(lat, lon, x.lat, x.lon)) }))
      .filter((x) => x.miles <= r && !shown(x))
      .sort((a, b) => a.miles - b.miles);
    return { packages, resorts };
  };
  const first = pick(radius);
  return first.packages.length + first.resorts.length >= 3 ? first : pick(radius * 2);
}
