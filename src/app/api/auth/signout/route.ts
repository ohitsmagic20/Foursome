import { db, handle } from '@/lib/server';

export function POST(req: Request) {
  return handle(async () => {
    const token = req.headers.get('x-session') || '';
    if (token) await db().from('sessions').delete().eq('token', token);
    return Response.json({ ok: true });
  });
}
