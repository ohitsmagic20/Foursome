import { ideaBySlug } from '@/lib/ideas';
import { handle, HttpError } from '@/lib/server';

// One trip idea (ready-made or shared by a group), for starting a trip from it.
export function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  return handle(async () => {
    const idea = await ideaBySlug((await params).slug);
    if (!idea) throw new HttpError(404, 'That trip idea isn’t available anymore.');
    return Response.json({ idea }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  });
}
