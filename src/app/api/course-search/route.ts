import { geocode } from '@/lib/geo';
import { searchCourses } from '@/lib/golfdb';
import { handle, str } from '@/lib/server';

// Course name suggestions while someone types, nearest to the trip's destination first.
// GET /api/course-search?q=whistl&place=Kohler, WI
export function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const text = str(q.get('q'), 80);
    const placeQ = str(q.get('place'), 80);
    const near = placeQ ? await geocode(placeQ) : null;
    const courses = await searchCourses(text, near, 8);
    return Response.json({ courses }, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
  });
}
