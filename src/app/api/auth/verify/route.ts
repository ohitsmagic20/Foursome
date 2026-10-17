import { cleanEmail, profileComplete, verifyCode } from '@/lib/auth';
import { body, handle, str } from '@/lib/server';

// Step 2 of sign-in: check the code, create the profile on first sign-in, return a session for this phone.
export function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const { profile, session, isNew } = await verifyCode(cleanEmail(b.email), str(b.code, 12));
    return Response.json({ session, profile, isNew, complete: profileComplete(profile) });
  });
}
