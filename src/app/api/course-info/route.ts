import { courseDetail } from '@/lib/golfdb';
import { handle, HttpError, str } from '@/lib/server';

// One course's details from the course database: type, rating/slope, description and facilities.
export function GET(req: Request) {
  return handle(async () => {
    const id = str(new URL(req.url).searchParams.get('id'), 40);
    const course = await courseDetail(id);
    if (!course) throw new HttpError(404, 'Course not found.');
    return Response.json({ course }, { headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=2592000' } });
  });
}
