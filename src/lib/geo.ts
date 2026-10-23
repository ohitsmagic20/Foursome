import 'server-only';
// Airports with scheduled passenger flights, from OurAirports (public domain): [iata, name, city, lat, lon, large(1/0), country]
import AIRPORTS from '@/data/airports.json';
import type { NearbyAirport } from './shared';

// Finding places on the map, with free services that need no API key:
//   OpenStreetMap's Nominatim (place → coordinates) and the bundled airport list.

const STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', PR: 'Puerto Rico',
};

export interface Place { name: string; region: string; country: string; lat: number; lon: number }


// Nicknames people type for golf trip cities.
const ALIASES: Record<string, string> = {
  la: 'Los Angeles, CA', 'l.a.': 'Los Angeles, CA', nyc: 'New York, NY', sf: 'San Francisco, CA', vegas: 'Las Vegas, NV',
  dc: 'Washington, DC', philly: 'Philadelphia, PA', nola: 'New Orleans, LA', oc: 'Irvine, CA', 'orange county': 'Irvine, CA',
  myrtle: 'Myrtle Beach, SC', scottsdale: 'Scottsdale, AZ', 'st andrews': 'St Andrews, Scotland', 'st. andrews': 'St Andrews, Scotland',
};

interface NominatimPlace {
  name?: string; lat: string; lon: string; category?: string; type?: string; addresstype?: string; importance?: number;
  address?: { city?: string; town?: string; village?: string; hamlet?: string; municipality?: string; county?: string; state?: string; country?: string; country_code?: string };
}

const UA = 'Foresome golf trip planner (https://www.foresomes.net; support@foresomes.net)';
const PLACE_TYPES = new Set(['city', 'town', 'village', 'hamlet', 'municipality', 'suburb', 'administrative', 'county', 'island', 'locality']);

/** "Myrtle Beach, SC" → coordinates, from OpenStreetMap's search (Nominatim: free, cached for a week per place).
 *  Uses the part after the comma to pick the right state or country. */
export async function geocode(rawQuery: string): Promise<Place | null> {
  const query = ALIASES[rawQuery.trim().toLowerCase()] || rawQuery;
  const parts = query.split(',').map((s) => s.trim()).filter(Boolean);
  const head = parts[0];
  if (!head) return null;
  const hint = (parts[1] || '').trim();
  const COUNTRY: Record<string, string> = { scotland: 'united kingdom', england: 'united kingdom', wales: 'united kingdom', uk: 'united kingdom', usa: 'united states', us: 'united states' };
  const hintFull = (COUNTRY[hint.toLowerCase()] || STATES[hint.toUpperCase()] || hint).toLowerCase();
  const q = hint ? `${head}, ${STATES[hint.toUpperCase()] || hint}` : head;

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=10&addressdetails=1&accept-language=en`;
  let results: NominatimPlace[] = [];
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, next: { revalidate: 60 * 60 * 24 * 7 } });
    if (!res.ok) return null;
    results = (await res.json()) as NominatimPlace[];
  } catch { return null; }
  if (!results.length) return null;

  const isPlace = (r: NominatimPlace) => r.category === 'place' || r.category === 'boundary' || PLACE_TYPES.has(r.addresstype || '');
  const matchesHint = (r: NominatimPlace) =>
    !!hint && ((r.address?.state || '').toLowerCase() === hintFull
      || (r.address?.country || '').toLowerCase() === hintFull
      || (r.address?.country_code || '').toUpperCase() === hint.toUpperCase());
  const places = results.filter(isPlace);
  const pool = places.length ? places : results;
  const pick = pool.find(matchesHint) || pool.find((r) => r.address?.country_code === 'us') || pool[0];
  const a = pick.address || {};
  return {
    name: a.city || a.town || a.village || a.hamlet || a.municipality || pick.name || head,
    region: a.state || '',
    country: a.country || '',
    lat: Number(pick.lat),
    lon: Number(pick.lon),
  };
}

export function miles(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* ---------- airports ---------- */

type AirportRow = [string, string, string, number, number, number, string];

// The busiest US hubs and the main airports for golf trips abroad: more nonstop options, so they rank ahead of a slightly closer small airport.
const HUBS = new Set('ATL DFW DEN ORD LAX JFK LAS MCO MIA CLT SEA PHX EWR SFO IAH BOS FLL MSP LGA DTW PHL SLC BWI DCA SAN IAD TPA BNA AUS MDW HNL DAL SJC OAK SMF RDU MCI STL MSY EDI GLA DUB SNN LHR LGW MAN YYZ YVR CUN SJD PUJ'.split(' '));

export function nearbyAirports(lat: number, lon: number, limit = 6): NearbyAirport[] {
  const rows = (AIRPORTS as AirportRow[])
    .map(([code, name, city, aLat, aLon, large]) => {
      const d = miles(lat, lon, aLat, aLon);
      // Lower score = better: distance, with credit for big airports that have more flights.
      const score = d - (HUBS.has(code) ? 30 : 0) - (large ? 15 : 0);
      return { code, name, city, miles: Math.round(d), major: !!large || HUBS.has(code), score };
    })
    .filter((a) => a.miles <= 150)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
  if (!rows.length) return [];
  // Pre-select the best airport, plus a second major one if it's also close.
  const second = rows.slice(1).find((a) => (HUBS.has(a.code) && a.miles <= 45) || (a.major && a.miles <= 30));
  return rows.map((a, i) => ({ code: a.code, name: a.name, city: a.city, miles: a.miles, major: a.major, suggested: i === 0 || a === second }));
}

/** Coordinates of an airport by its code, from the bundled list. */
export function airportCoords(code: string): { lat: number; lon: number } | null {
  const row = (AIRPORTS as AirportRow[]).find((a) => a[0] === code.toUpperCase());
  return row ? { lat: row[3], lon: row[4] } : null;
}

/** Find a golf course by name near a point (within about 100 miles), from OpenStreetMap. Cached for a month.
 *  Prefers places tagged as golf courses, and the one closest to the destination when several share a name. */
export async function findCourse(name: string, near: { lat: number; lon: number }): Promise<{ lat: number; lon: number } | null> {
  const base = name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const inside = (name.match(/\((.*?)\)/) || [])[1] || '';
  const generic = /^(north|south|east|west|old|new|irish|straits|river|lake|ridge|judge|stadium|monument|saguaro|cholla|bluffs|links|dye course|meadow valleys)$/i;
  const short = base.replace(/\b(inn|lodge|resort)\b\s*&?\s*/gi, '').replace(/\b(golf (club|course|links|resort)|golf & (country club|cc)|country club|golf club|club|gc|cc)\b\.?/gi, '').replace(/[&,]+\s*$/, '').trim();
  const tries = [...new Set([
    inside && !generic.test(inside) ? `${base} ${inside}` : '',
    inside && !generic.test(inside) ? inside : '',
    base, short, `${short} golf`,
  ].filter((x) => x && x.length > 2))];
  type Hit = { lat: string; lon: string; category?: string; type?: string };
  const dist = (h: Hit) => miles(near.lat, near.lon, Number(h.lat), Number(h.lon));
  let fallback: Hit | null = null;
  let calls = 0;
  for (const pad of [0.8, 1.5]) {
    const box = [near.lon - pad, near.lat + pad, near.lon + pad, near.lat - pad].map((x) => x.toFixed(3)).join(',');
    for (const q of tries) {
      if (calls++) await new Promise((r) => setTimeout(r, 1000)); // OpenStreetMap asks for at most one search per second
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=10&bounded=1&viewbox=${box}`, {
          headers: { 'User-Agent': UA, Accept: 'application/json' }, next: { revalidate: 60 * 60 * 24 * 30 },
        });
        if (!res.ok) continue;
        const hits = ((await res.json()) as Hit[]).sort((a, b) => dist(a) - dist(b));
        const golf = hits.find((h) => h.type === 'golf_course');
        if (golf) return { lat: Number(golf.lat), lon: Number(golf.lon) };
        fallback ||= hits.find((h) => h.category === 'leisure') || null;
      } catch { /* try the next wording */ }
    }
  }
  return fallback ? { lat: Number(fallback.lat), lon: Number(fallback.lon) } : null;
}
