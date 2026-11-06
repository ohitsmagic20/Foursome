import RESORTS_JSON from '@/data/resorts.json';
import COORDS from '@/data/package-coords.json';
import LISTINGS from '@/data/listings.json';
import { PACKAGES, type StayPlay } from '@/data/packages';
import { miles } from './geo';

// Every US golf resort we've catalogued (from GolfPass's state-by-state resort directories, Golf Digest's
// best golf resorts and the golftrips.com package directory, Nov 2026), with the nearest town's coordinates.
// Nearly all sell some form of stay and play. Packages come from data/packages.ts (curated, from the resorts and
// GolfPass) and data/listings.json (every resort, hotel and course package on the GolfTrips network's state sites).

export interface Resort { resort: string; city: string; state: string; courses: string[]; lat: number; lon: number }
export const RESORTS = RESORTS_JSON as Resort[];
const PKG_AT = COORDS as unknown as Record<string, [number, number]>;

export type Placed = StayPlay & { lat: number; lon: number };
/** Every package we know of, with where it is. */
export const ALL_PACKAGES: Placed[] = [
  ...PACKAGES.filter((p) => PKG_AT[p.id]).map((p) => ({ ...p, lat: PKG_AT[p.id][0], lon: PKG_AT[p.id][1] })),
  ...(LISTINGS as unknown as Omit<Placed, 'checked'>[]).map((l) => ({ ...l, checked: 'Nov 2026' })),
];

export const resortSearchUrl = (r: Pick<Resort, 'resort' | 'city' | 'state'>) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${r.resort} ${r.city} ${r.state} stay and play golf package`)}`;

const key = (s: string) => s.toLowerCase().replace(/^the /, '').replace(/[^a-z0-9 ]/g, '').split(' ').slice(0, 2).join(' ');

export type Near<T> = T & { miles: number };

/** Packages and resorts within `radius` miles of a point (wider if there's almost nothing close).
 *  Packages are nearest first, with posted prices ahead of quote-only ones at about the same distance. */
export function nearby(lat: number, lon: number, radius = 75): { packages: Near<StayPlay>[]; resorts: Near<Resort>[] } {
  const pick = (r: number) => {
    const close = ALL_PACKAGES.map((p) => ({ p, miles: Math.round(miles(lat, lon, p.lat, p.lon)) })).filter((x) => x.miles <= r);
    const packages = close
      .sort((a, b) => Math.round(a.miles / 15) - Math.round(b.miles / 15) || (a.p.price ? 0 : 1) - (b.p.price ? 0 : 1) || a.miles - b.miles)
      .map(({ p, miles: m }) => { const { lat: _a, lon: _o, ...rest } = p; return { ...rest, miles: m }; });
    // Skip a resort already shown as a package: same name start, same state, within a few miles.
    const shown = (x: Resort) => close.some(({ p }) => p.state === x.state && key(p.resort) === key(x.resort) && miles(x.lat, x.lon, p.lat, p.lon) < 5);
    const resorts = RESORTS.map((x) => ({ ...x, miles: Math.round(miles(lat, lon, x.lat, x.lon)) }))
      .filter((x) => x.miles <= r && !shown(x))
      .sort((a, b) => a.miles - b.miles);
    return { packages, resorts };
  };
  const first = pick(radius);
  return first.packages.length + first.resorts.length >= 3 ? first : pick(radius * 2);
}
