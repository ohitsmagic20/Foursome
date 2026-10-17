import { geocode, miles } from '@/lib/geo';
import { handle, HttpError, int, str } from '@/lib/server';
import type { NearbyCourse } from '@/lib/shared';

// Golf courses near a destination, from OpenStreetMap (free, no key; data © OpenStreetMap contributors, ODbL).

interface OsmElement { lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

const NOT_GOLF = /\b(mini|miniature|putt|putting|disc|frisbee|foot ?golf|driving range|par 3 kids)\b/i;

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
    const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Foursome golf trip planner' },
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!res.ok) throw new HttpError(502, 'The course map is busy right now. Try again in a minute.');
    const json = (await res.json()) as { elements?: OsmElement[] };

    const seen = new Set<string>();
    const courses: NearbyCourse[] = [];
    for (const el of json.elements || []) {
      const t = el.tags || {};
      const name = (t.name || '').trim();
      const lat = el.center?.lat ?? el.lat, lon = el.center?.lon ?? el.lon;
      if (!name || lat === undefined || lon === undefined || NOT_GOLF.test(name)) continue;
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
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  });
}
