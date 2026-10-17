import { cleanEmail, sendCode } from '@/lib/auth';
import { body, handle } from '@/lib/server';

// Step 1 of sign-in: email a 6-digit code. Works for new and returning people.
export function POST(req: Request) {
  return handle(async () => {
    const email = cleanEmail((await body(req)).email);
    await sendCode(email, new URL(req.url).origin);
    return Response.json({ ok: true });
  });
}
