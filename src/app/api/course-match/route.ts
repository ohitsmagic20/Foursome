import { geocode } from '@/lib/geo';
import { courseDetail, matchCourse } from '@/lib/golfdb';
import { handle, HttpError, str } from '@/lib/server';
import type { CourseAccess, CourseTee } from '@/lib/shared';

// The course database's type and tees for a list of course names near a place (the Golf tab's nearby list).
// GET /api/course-match?place=Myrtle Beach, SC&course=True Blue Golf Club&course=...
export const maxDuration = 30;

export function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const place = await geocode(str(q.get('place'), 80));
    if (!place) throw new HttpError(404, 'Couldn’t find that place.');
    const names = [...new Set(q.getAll('course').map((c) => str(c, 100)).filter(Boolean))].slice(0, 20);
    const out: Record<string, { access: CourseAccess; tees: CourseTee[] }> = {};
    await Promise.all(names.map(async (name) => {
      const hit = await matchCourse(name, place);
      const info = hit ? await courseDetail(hit.id) : null;
      if (info) out[name] = { access: info.access, tees: info.tees };
    }));
    return Response.json({ courses: out }, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=604800' } });
  });
}
