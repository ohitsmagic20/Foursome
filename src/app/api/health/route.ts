import { db, explain } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Setup check: open /api/health in a browser. Shows what is configured without revealing any keys.
export async function GET() {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const duffel = process.env.DUFFEL_ACCESS_TOKEN || '';
  const ref = (url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i) || [])[1] || '';
  const report: Record<string, string> = {
    project_ref: ref ? `${ref.slice(0, 4)}…${ref.slice(-3)}` : 'unknown',
    SUPABASE_URL: !url ? 'missing' : /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim()) ? 'looks right' : `unexpected format (starts with "${url.slice(0, 12)}…", should be https://xxxx.supabase.co)`,
    SUPABASE_SECRET_KEY: !key ? 'missing' : key.startsWith('sb_secret_') ? 'set (secret key)' : key.startsWith('sb_publishable_') ? 'WRONG KEY: this is the publishable key, use the secret key' : key.startsWith('eyJ') ? 'set (legacy JWT key: make sure it is service_role, not anon)' : 'set (unrecognized format)',
    DUFFEL_ACCESS_TOKEN: !duffel ? 'missing' : duffel.startsWith('duffel_test_') ? 'set (test mode)' : duffel.startsWith('duffel_live_') ? 'set (live)' : 'set (unrecognized format)',
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY ? 'set' : 'missing (Google ratings off)',
    RESEND_API_KEY: process.env.RESEND_API_KEY ? 'set' : 'missing (trip emails off)',
    url_has_spaces: /\s/.test(url) ? 'yes: remove spaces' : 'no',
    key_has_spaces: /\s/.test(key) ? 'yes: remove spaces' : 'no',
  };
  if (url && key) {
    try {
      for (const t of ['trips', 'members', 'options', 'votes']) {
        const { error } = await db().from(t).select('*').limit(1);
        if (error) throw Object.assign(new Error(`${t}: ${error.message}`), { code: error.code });
      }
      report.database = 'connected, all 4 tables found';
    } catch (e) {
      report.database = `error: ${explain(e)}`;
      report.database_detail = String((e as { code?: string }).code || '') + ' ' + String((e as Error).message || '').slice(0, 160);
    }
  }
  if (url && key) {
    const missing: string[] = [];
    for (const t of ['profiles', 'sessions']) {
      const { error } = await db().from(t).select('*').limit(1);
      if (error) missing.push(t);
    }
    report.accounts = missing.length ? `not set up: run supabase/002_accounts.sql (missing ${missing.join(', ')})` : 'ready';
    const n1 = await db().from('push_subs').select('endpoint').limit(1);
    const n2 = await db().from('trips').select('last_nudge').limit(1);
    report.notifications = n1.error || n2.error ? 'not set up: run supabase/003_notifications.sql' : 'ready';
  }
  return Response.json(report, { headers: { 'Cache-Control': 'no-store' } });
}
