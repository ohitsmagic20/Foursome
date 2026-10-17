import 'server-only';
// Airports with scheduled passenger flights, from OurAirports (public domain): [iata, name, city, lat, lon, large(1/0), country]
import AIRPORTS from '@/data/airports.json';
import type { NearbyAirport } from './shared';

// Finding places on the map, with free services that need no API key:
//   Open-Meteo geocoding (place → coordinates) and OpenStreetMap's Overpass API (golf courses nearby).

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

interface GeoResult { name: string; latitude: number; longitude: number; admin1?: string; country?: string; country_code?: string; population?: number }

// Nicknames people type for golf trip cities.
const ALIASES: Record<string, string> = {
  la: 'Los Angeles, CA', 'l.a.': 'Los Angeles, CA', nyc: 'New York, NY', sf: 'San Francisco, CA', vegas: 'Las Vegas, NV',
  dc: 'Washington, DC', philly: 'Philadelphia, PA', nola: 'New Orleans, LA', oc: 'Irvine, CA', 'orange county': 'Irvine, CA',
  myrtle: 'Myrtle Beach, SC', scottsdale: 'Scottsdale, AZ', 'st andrews': 'St Andrews, Scotland', 'st. andrews': 'St Andrews, Scotland',
};

/** "Myrtle Beach, SC" → coordinates. Uses the part after the comma to pick the right state or country. */
export async function geocode(rawQuery: string): Promise<Place | null> {
  const query = ALIASES[rawQuery.trim().toLowerCase()] || rawQuery;
  const parts = query.split(',').map((s) => s.trim()).filter(Boolean);
  const head = parts[0];
  if (!head) return null;
  const hint = (parts[1] || '').trim();
  const COUNTRY: Record<string, string> = { scotland: 'united kingdom', england: 'united kingdom', wales: 'united kingdom', uk: 'united kingdom', usa: 'united states', us: 'united states' };
  const hintFull = (COUNTRY[hint.toLowerCase()] || STATES[hint.toUpperCase()] || hint).toLowerCase();

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(head)}&count=10&language=en&format=json`;
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } });
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: GeoResult[] };
  const results = json.results || [];
  if (!results.length) return null;

  const matchesHint = (r: GeoResult) =>
    !!hint && ((r.admin1 || '').toLowerCase() === hintFull
      || (r.country || '').toLowerCase() === hintFull
      || (r.country_code || '').toUpperCase() === hint.toUpperCase());
  const pick = results.find(matchesHint) || results.find((r) => r.country_code === 'US') || results[0];
  return { name: pick.name, region: pick.admin1 || '', country: pick.country || '', lat: pick.latitude, lon: pick.longitude };
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
