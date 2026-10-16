import { db, explain } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Setup check: open /api/health in a browser. Shows what is configured without revealing any keys.
export async function GET() {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const duffel = process.env.DUFFEL_ACCESS_TOKEN || '';
  const report: Record<string, string> = {
    SUPABASE_URL: !url ? 'missing' : /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url.trim()) ? 'looks right' : `unexpected format (starts with "${url.slice(0, 12)}…", should be https://xxxx.supabase.co)`,
    SUPABASE_SECRET_KEY: !key ? 'missing' : key.startsWith('sb_secret_') ? 'set (secret key)' : key.startsWith('sb_publishable_') ? 'WRONG KEY: this is the publishable key, use the secret key' : key.startsWith('eyJ') ? 'set (legacy JWT key: make sure it is service_role, not anon)' : 'set (unrecognized format)',
    DUFFEL_ACCESS_TOKEN: !duffel ? 'missing' : duffel.startsWith('duffel_test_') ? 'set (test mode)' : duffel.startsWith('duffel_live_') ? 'set (live)' : 'set (unrecognized format)',
    url_has_spaces: /\s/.test(url) ? 'yes: remove spaces' : 'no',
    key_has_spaces: /\s/.test(key) ? 'yes: remove spaces' : 'no',
  };
  if (url && key) {
    try {
      for (const t of ['trips', 'members', 'options', 'votes']) {
        const { error } = await db().from(t).select('*', { head: true, count: 'exact' }).limit(1);
        if (error) throw error;
      }
      report.database = 'connected, all 4 tables found';
    } catch (e) {
      report.database = `error: ${explain(e)}`;
    }
  }
  return Response.json(report, { headers: { 'Cache-Control': 'no-store' } });
}
