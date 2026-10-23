import { geocode, miles } from '@/lib/geo';
import { handle, HttpError, int, str } from '@/lib/server';
import type { NearbyCourse } from '@/lib/shared';

// Golf courses near a destination, from OpenStreetMap (free, no key; data © OpenStreetMap contributors, ODbL).

interface OsmElement { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

const NOT_GOLF = /\b(mini|miniature|putt|putting|disc|frisbee|foot ?golf|driving range|par 3 kids)\b/i;

interface NominatimHit { name?: string; lat: string; lon: string; category?: string; type?: string; extratags?: Record<string, string> | null }

const UA = 'Foursome golf trip planner (https://foresome-one.vercel.app)';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** OpenStreetMap's search service (Nominatim). Its usage policy asks for at most one request per second
 *  and a real User-Agent; answers are cached for a week by the CDN, so each area is looked up rarely. */
async function nominatim(lat: number, lon: number, radiusMi: number): Promise<OsmElement[] | null> {
  const dLat = radiusMi / 69, dLon = radiusMi / (69 * Math.cos((lat * Math.PI) / 180));
  const box = [lon - dLon, lat + dLat, lon + dLon, lat - dLat].map((x) => x.toFixed(4)).join(',');
  const out: OsmElement[] = [];
  let ok = false;
  for (const [i, q] of ['golf course', 'golf club', 'country club'].entries()) {
    if (i) await wait(1100);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 10000);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=40&bounded=1&viewbox=${box}&extratags=1`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal, cache: 'no-store',
      });
      if (!res.ok) continue;
      ok = true;
      for (const h of (await res.json()) as NominatimHit[]) {
        if (h.category !== 'leisure' || h.type !== 'golf_course') continue;
        out.push({ lat: Number(h.lat), lon: Number(h.lon), tags: { name: h.name || '', ...(h.extratags || {}) } });
      }
    } catch { /* try the next search */ } finally { clearTimeout(timer); }
  }
  return ok ? out : null;
}

/** Overpass (the OpenStreetMap query service) as a backup; its public servers are often busy. */
async function overpass(query: string): Promise<OsmElement[] | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, { headers: { 'User-Agent': UA }, signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    const j = await res.json();
    return Array.isArray(j?.elements) ? j.elements : null;
  } catch { return null; } finally { clearTimeout(timer); }
}

export const maxDuration = 45;

export function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const placeQ = str(q.get('place'), 80);
    const radiusMi = int(q.get('miles'), 5, 60, 30);
    if (!placeQ) throw new HttpError(400, 'Missing place.');

    const place = await geocode(placeQ);
    if (!place) throw new HttpError(404, `Couldn't find “${placeQ}” on the map. Try “City, ST”.`);

    const m = Math.round(radiusMi * 1609.34);
    const around = `around:${m},${place.lat},${place.lon}`;
    const query = `[out:json][timeout:25];(way["leisure"="golf_course"]["name"](${around});relation["leisure"="golf_course"]["name"](${around}););out center tags 150;`;
    const elements = (await nominatim(place.lat, place.lon, radiusMi)) ?? (await overpass(query));
    if (!elements) throw new HttpError(502, 'The course map is busy right now. Try again in a minute.');


    const seen = new Set<string>();
    const courses: NearbyCourse[] = [];
    for (const el of elements) {
      const t = el.tags || {};
      const name = (t.name || '').trim();
      const lat = el.center?.lat ?? el.lat, lon = el.center?.lon ?? el.lon;
      if (!name || lat === undefined || lon === undefined || NOT_GOLF.test(name)) continue;
      if (miles(place.lat, place.lon, lat, lon) > radiusMi) continue; // the search box is square; keep the circle
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(key)) continue;
      seen.add(key);
      const website = t.website || t['contact:website'] || t.url || '';
      courses.push({
        name,
        miles: Math.round(miles(place.lat, place.lon, lat, lon)),
        website: /^https?:\/\//i.test(website) ? website : website ? `https://${website}` : '',
        phone: t.phone || t['contact:phone'] || '',
        holes: t['golf:holes'] || t.holes || '',
        isPrivate: ['private', 'members', 'no'].includes((t.access || '').toLowerCase()),
        lat, lon,
      });
    }
    courses.sort((a, b) => Number(a.isPrivate) - Number(b.isPrivate) || a.miles - b.miles);

    return Response.json({ place: `${place.name}${place.region ? `, ${place.region}` : ''}`, radius: radiusMi, courses: courses.slice(0, 40) }, {
      headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=604800' },
    });
  });
}
