import { deleteAccount, profileFromRequest } from '@/lib/auth';
import { body, handle, HttpError, str } from '@/lib/server';

// Permanently delete the signed-in person's account. Requires typing DELETE.
export function POST(req: Request) {
  return handle(async () => {
    const me = await profileFromRequest(req, true);
    if (str((await body(req)).confirm, 20).trim().toUpperCase() !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm.');
    await deleteAccount(me);
    return Response.json({ ok: true });
  });
}
