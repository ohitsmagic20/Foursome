import { after } from 'next/server';
import { profileFromRequest } from '@/lib/auth';
import { emailOwner } from '@/lib/email';
import { ownerEmails } from '@/lib/owner';
import { body, db, handle, HttpError, ipKey, logError, rateLimit, str } from '@/lib/server';

// Notes from the Feedback link. Saved for the owner's stats page and emailed to the owner when email is on.
export function POST(req: Request) {
  return handle(async () => {
    await rateLimit(`feedback:${ipKey(req)}`, 8, 60, 'Thanks! That’s a lot of feedback for one hour. Try again a bit later.');
    const b = await body(req);
    const message = str(b.message, 2000);
    if (message.length < 2) throw new HttpError(400, 'Write a note first.');
    const me = await profileFromRequest(req, false).catch(() => null);
    const typed = str(b.email, 120);
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed) ? typed : me?.email || '';
    const path = str(b.path, 200);
    const trip_code = str(b.tripCode, 20).replace(/[^a-z0-9]/gi, '');

    const { error } = await db().from('feedback').insert({ message, email, path, trip_code });
    // Before migration 006 the table doesn't exist: keep the note in the error log so it isn't lost.
    if (error) await logError('client', `Feedback: ${message}`, path, email ? `Reply to: ${email}` : '');

    after(async () => {
      await emailOwner(ownerEmails(), 'Foresome feedback', [
        message,
        `From: ${email || 'no email given'}`,
        `Page: ${path || 'unknown'}${trip_code ? ` (trip ${trip_code})` : ''}`,
      ]).catch(() => false);
    });
    return Response.json({ ok: true });
  });
}
