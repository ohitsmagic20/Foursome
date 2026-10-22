import { pollLogin, profileComplete } from '@/lib/auth';
import { handle, HttpError, str } from '@/lib/server';

export const dynamic = 'force-dynamic';

// The device waiting for its sign-in link asks every few seconds whether the link was opened.
export function GET(req: Request) {
  return handle(async () => {
    const nonce = str(new URL(req.url).searchParams.get('n'), 64);
    if (!nonce) throw new HttpError(400, 'Missing sign-in request.');
    const r = await pollLogin(nonce);
    if (!r) return Response.json({ done: false }, { headers: { 'Cache-Control': 'no-store' } });
    return Response.json({ done: true, session: r.session, profile: r.profile, complete: profileComplete(r.profile) }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
