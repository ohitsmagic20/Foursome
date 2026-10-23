import { db, handle, HttpError } from '@/lib/server';
import { APP_URL, emailOwner } from '@/lib/email';
import { ownerEmails } from '@/lib/owner';

export const dynamic = 'force-dynamic';

// Runs once a day (vercel.json). Touching the database keeps the free Supabase project from pausing
// after a week without traffic, and old sign-in records are cleared out.
export function GET(req: Request) {
  return handle(async () => {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) throw new HttpError(401, 'Not allowed.');
    const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();
    const results: Record<string, string> = {};
    const run = async (name: string, q: PromiseLike<{ error: { message: string } | null; count?: number | null }>) => {
      const { error, count } = await q;
      results[name] = error ? `error: ${error.message}` : `ok${typeof count === 'number' ? ` (${count})` : ''}`;
    };
    await run('ping', db().from('trips').select('id', { count: 'exact', head: true }));
    await run('login_requests', db().from('login_requests').delete({ count: 'exact' }).lt('created_at', ago(1)));
    await run('rate_events', db().from('rate_events').delete({ count: 'exact' }).lt('at', ago(1)));
    await run('sessions', db().from('sessions').delete({ count: 'exact' }).lt('last_seen', ago(180)));
    await run('app_errors', db().from('app_errors').delete({ count: 'exact' }).lt('at', ago(30)));
    // Tell the owner about yesterday's errors (needs RESEND_API_KEY and OWNER_EMAIL).
    const { data: errs } = await db().from('app_errors').select('message,source').gte('at', ago(1)).limit(500);
    if (errs?.length) {
      const counts = new Map<string, number>();
      for (const e of errs) counts.set(`${e.source}: ${e.message}`, (counts.get(`${e.source}: ${e.message}`) || 0) + 1);
      const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([m, n]) => `${n}× ${m}`);
      const sent = await emailOwner(ownerEmails(), `Foresome: ${errs.length} error${errs.length > 1 ? 's' : ''} in the last day`, [...top, `Details: ${APP_URL}/stats`]);
      results.errorEmail = sent ? 'sent' : 'not sent (needs RESEND_API_KEY and OWNER_EMAIL)';
    }
    return Response.json({ ok: true, results }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
