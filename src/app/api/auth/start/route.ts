import { cleanEmail, sendCode } from '@/lib/auth';
import { body, handle, ipKey, rateLimit } from '@/lib/server';

// Step 1 of sign-in: email a 6-digit code. Works for new and returning people.
export function POST(req: Request) {
  return handle(async () => {
    const email = cleanEmail((await body(req)).email);
    await rateLimit(`signin-email:${email}`, 5, 60, 'Too many codes sent to this email. Wait an hour, or use the newest code you have.');
    await rateLimit(`signin-ip:${ipKey(req)}`, 15, 60, 'Too many sign-in attempts from this device. Try again in an hour.');
    const nonce = await sendCode(email, new URL(req.url).origin);
    return Response.json({ ok: true, nonce });
  });
}
