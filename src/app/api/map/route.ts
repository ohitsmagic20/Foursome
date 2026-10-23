import { airportCoords, findCourse, geocode } from '@/lib/geo';
import { courseDetail, matchCourse } from '@/lib/golfdb';
import { handle, HttpError, str } from '@/lib/server';
import type { CourseInfo } from '@/lib/shared';

// Everything the Golf tab knows about a trip's courses: where they are (for the mini map), how the public
// can play them, and course rating / slope. Courses come from the course database (OpenGolfAPI); anything it
// doesn't list falls back to an OpenStreetMap search for a map location only.
// GET /api/map?place=Kohler, WI&airport=MKE&course=Erin Hills&course=Whistling Straits (Irish)
//   course values: "Name", "Name::id:<course id>" (picked from the database), or "Name::<search text>".
export const maxDuration = 60;

export interface MapCourse extends Partial<Omit<CourseInfo, 'name' | 'lat' | 'lon'>> { name: string; lat: number; lon: number }

export function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const placeQ = str(q.get('place'), 80);
    if (!placeQ) throw new HttpError(400, 'Missing place.');
    const names = [...new Set(q.getAll('course').map((c) => str(c, 140)).filter(Boolean))].slice(0, 12);
    const place = await geocode(placeQ);
    if (!place) throw new HttpError(404, 'Couldn’t find that place.');
    const code = str(q.get('airport'), 3).toUpperCase();
    const airport = code ? airportCoords(code) : null;

    // 1. The course database, all at once.
    const found = await Promise.all(names.map(async (raw): Promise<MapCourse | null> => {
      const [label, hint = ''] = raw.split('::');
      const id = hint.startsWith('id:') ? hint.slice(3) : '';
      const hit = id ? { id } : await matchCourse(hint || label, place);
      const info = hit ? await courseDetail(hit.id) : null;
      return info ? { ...info, name: label } : null;
    }));

    // 2. OpenStreetMap search for the rest, one per second (its usage policy).
    const courses: MapCourse[] = [];
    let osmCalls = 0;
    for (const [i, raw] of names.entries()) {
      if (found[i]) { courses.push(found[i]!); continue; }
      const [label, hint = ''] = raw.split('::');
      if (osmCalls++) await new Promise((r) => setTimeout(r, 1000));
      const at = await findCourse(hint && !hint.startsWith('id:') ? hint : label, place, !!hint && !hint.startsWith('id:'));
      if (at) courses.push({ name: label, ...at });
    }
    return Response.json(
      { center: { lat: place.lat, lon: place.lon }, airport: airport ? { code, ...airport } : null, courses },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=604800' } },
    );
  });
}
