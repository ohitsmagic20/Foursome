import 'server-only';

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

/** "Myrtle Beach, SC" → coordinates. Uses the part after the comma to pick the right state or country. */
export async function geocode(query: string): Promise<Place | null> {
  const parts = query.split(',').map((s) => s.trim()).filter(Boolean);
  const head = parts[0];
  if (!head) return null;
  const hint = (parts[1] || '').trim();
  const hintFull = (STATES[hint.toUpperCase()] || hint).toLowerCase();

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
