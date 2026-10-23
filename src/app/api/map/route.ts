import { airportCoords, findCourse, geocode } from '@/lib/geo';
import { handle, HttpError, str } from '@/lib/server';

// Points for a trip's mini map: the arrival airport and each course, found on OpenStreetMap.
// GET /api/map?place=Kohler, WI&airport=MKE&course=Erin Hills&course=Whistling Straits (Straits)
export const maxDuration = 30;

export function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const placeQ = str(q.get('place'), 80);
    if (!placeQ) throw new HttpError(400, 'Missing place.');
    const names = [...new Set(q.getAll('course').map((c) => str(c, 100)).filter(Boolean))].slice(0, 10);
    const place = await geocode(placeQ);
    if (!place) throw new HttpError(404, 'Couldn’t find that place.');
    const code = str(q.get('airport'), 3).toUpperCase();
    const airport = code ? airportCoords(code) : null;
    const courses: { name: string; lat: number; lon: number }[] = [];
    // One lookup at a time: OpenStreetMap's search asks for at most one request per second (answers are cached).
    for (const [i, name] of names.entries()) {
      if (i) await new Promise((r) => setTimeout(r, 1000));
      const at = await findCourse(name, place);
      if (at) courses.push({ name, ...at });
    }
    return Response.json(
      { center: { lat: place.lat, lon: place.lon }, airport: airport ? { code, ...airport } : null, courses },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=2592000' } },
    );
  });
}
