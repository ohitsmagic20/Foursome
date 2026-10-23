import { unsubscribeKey } from '@/lib/email';
import { body, db, handle, HttpError, str } from '@/lib/server';

// Turn off trip emails from an email's link, no sign-in needed. POST only, so link scanners can't trigger it;
// mail apps' one-click unsubscribe (RFC 8058) posts here with the ids in the query string.
export function POST(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const b = await body(req).catch(() => ({} as Record<string, unknown>));
    const p = str(q.get('p') || b.p, 40), k = str(q.get('k') || b.k, 40);
    if (!p || k !== unsubscribeKey(p)) throw new HttpError(400, 'This unsubscribe link isn’t valid.');
    const { error } = await db().from('profiles').update({ email_updates: false }).eq('id', p);
    if (error) throw error;
    return Response.json({ ok: true });
  });
}
