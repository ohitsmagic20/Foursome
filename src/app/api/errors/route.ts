import { body, handle, ipKey, logError, rateLimit, str } from '@/lib/server';

// Errors from people's phones (see ErrorReporter), so the owner hears about problems.
export function POST(req: Request) {
  return handle(async () => {
    await rateLimit(`errors:${ipKey(req)}`, 30, 60, 'Too many error reports.');
    const b = await body(req);
    const message = str(b.message, 500);
    if (message) await logError('client', message, str(b.path, 200), str(b.detail, 2000));
    return Response.json({ ok: true });
  });
}
