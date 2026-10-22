import { profileComplete, verifyLinkToken } from '@/lib/auth';
import { body, handle, HttpError, str } from '@/lib/server';

// Sign-in from the emailed link (fallback when the email has a link instead of a code).
export function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const token = str(b.access_token, 4000);
    if (!token) throw new HttpError(400, 'Missing sign-in token.');
    const { profile, session, isNew } = await verifyLinkToken(token, str(b.nonce, 64) || undefined);
    return Response.json({ session, profile, isNew, complete: profileComplete(profile) });
  });
}
