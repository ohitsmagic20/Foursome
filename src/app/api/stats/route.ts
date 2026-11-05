import { profileFromRequest } from '@/lib/auth';
import { isOwner } from '@/lib/owner';
import { db, handle, HttpError } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Numbers for the app owner: how many trips and people, which trip ideas get used, and recent errors.
export function GET(req: Request) {
  return handle(async () => {
    const me = await profileFromRequest(req, true);
    if (!isOwner(me.email)) throw new HttpError(403, 'Only the app owner can see this page.');
    const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();
    const count = async (table: string, f?: (q: any) => any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      let q = db().from(table).select('*', { count: 'exact', head: true });
      if (f) q = f(q);
      const { count: c } = await q;
      return c || 0;
    };
    const [trips, trips7, trips30, members, guests, accounts, expenses, shared, errors7] = await Promise.all([
      count('trips'), count('trips', (q) => q.gte('created_at', ago(7))), count('trips', (q) => q.gte('created_at', ago(30))),
      count('members'), count('members', (q) => q.is('profile_id', null)), count('profiles'),
      count('expenses'), count('trip_ideas'), count('app_errors', (q) => q.gte('at', ago(7))),
    ]);
    // Trips by week, last 8 weeks.
    const { data: recent } = await db().from('trips').select('created_at').gte('created_at', ago(56));
    const weeks = Array.from({ length: 8 }, (_, i) => ({ start: ago(56 - i * 7).slice(0, 10), trips: 0 }));
    for (const t of recent || []) {
      const i = Math.min(7, Math.floor((Date.parse(t.created_at) - Date.parse(ago(56))) / (7 * 864e5)));
      if (i >= 0) weeks[i].trips++;
    }
    // Trips that locked dates and a destination (a real plan), and trips started from trip ideas.
    const { data: locked } = await db().from('options').select('trip_id,kind').eq('locked', true).in('kind', ['date', 'destination']);
    const byTrip = new Map<string, Set<string>>();
    for (const o of locked || []) byTrip.set(o.trip_id, (byTrip.get(o.trip_id) || new Set()).add(o.kind));
    const planned = [...byTrip.values()].filter((s) => s.size === 2).length;
    const { data: fromIdeas } = await db().from('options').select('trip_id,data').eq('kind', 'round').not('data->>fromTemplate', 'is', null).limit(5000);
    const ideaTrips = new Map<string, Set<string>>();
    for (const o of fromIdeas || []) {
      const slug = String((o.data as { fromTemplate?: string }).fromTemplate);
      ideaTrips.set(slug, (ideaTrips.get(slug) || new Set()).add(o.trip_id));
    }
    const ideas = [...ideaTrips].map(([slug, s]) => ({ slug, trips: s.size })).sort((a, b) => b.trips - a.trips);
    const { data: errs } = await db().from('app_errors').select('at,source,message,path').not('message', 'like', 'Feedback:%').order('at', { ascending: false }).limit(25);

    // Funnel: of trips started in the window, how many reached each step.
    const days = Number(new URL(req.url).searchParams.get('days')) || 0;
    const funnel = await tripFunnel(days ? ago(days) : null);

    // Feedback (table from migration 006; before that, notes are kept in the error log).
    const fb = await db().from('feedback').select('at,message,email,path,trip_code').order('at', { ascending: false }).limit(50);
    const feedback = fb.error
      ? ((await db().from('app_errors').select('at,message,path,detail').like('message', 'Feedback:%').order('at', { ascending: false }).limit(50)).data || [])
        .map((e) => ({ at: e.at, message: String(e.message).replace(/^Feedback:\s*/, ''), email: String(e.detail || '').replace(/^Reply to:\s*/, ''), path: e.path, trip_code: '' }))
      : fb.data || [];

    return Response.json({
      trips, trips7, trips30, planned, members, guests, accounts, expenses, shared, errors7,
      groupSize: trips ? Math.round((members / trips) * 10) / 10 : 0,
      weeks, ideas, errors: errs || [], funnel, funnelDays: days, feedback,
    }, { headers: { 'Cache-Control': 'no-store' } });
  });
}

const ROWS = 10000;

/** Run a query for ids in batches (Supabase returns at most 1,000 rows per request). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function inChunks(ids: string[], q: (chunk: string[]) => PromiseLike<{ data: any[] | null }>): Promise<any[]> {
  const out: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await q(ids.slice(i, i + 100));
    out.push(...(data || []));
  }
  return out;
}

/** How far trips got: each step counts the trips (started since `since`, or ever) that reached it. */
async function tripFunnel(since: string | null) {
  let tq = db().from('trips').select('id').limit(ROWS);
  if (since) tq = tq.gte('created_at', since);
  const { data: tripRows } = await tq;
  const ids = new Set((tripRows || []).map((t) => t.id as string));
  const steps = [
    { key: 'created', label: 'Trip created' },
    { key: 'joined', label: 'Someone joined' },
    { key: 'three', label: '3 or more joined' },
    { key: 'voting', label: '2 or more people voted' },
    { key: 'date', label: 'Dates locked' },
    { key: 'destination', label: 'Destination locked' },
    { key: 'lodging', label: 'Place to stay locked' },
    { key: 'round', label: 'Golf in the plan' },
    { key: 'booked', label: 'All tee times booked' },
    { key: 'flights', label: 'Half the group has flights' },
  ];
  if (!ids.size) return steps.map((s) => ({ ...s, trips: 0 }));

  const tripIds = [...ids];
  const [members, options] = await Promise.all([
    inChunks(tripIds, (c) => db().from('members').select('id,trip_id,flight_price').in('trip_id', c)),
    inChunks(tripIds, (c) => db().from('options').select('id,trip_id,kind,locked,data').in('trip_id', c)),
  ]);
  const optTrip = new Map(options.map((o) => [o.id as string, o.trip_id as string]));
  const voters = new Map<string, Set<string>>();
  const votes = await inChunks([...optTrip.keys()], (c) => db().from('votes').select('option_id,member_id').in('option_id', c));
  for (const v of votes) {
    const t = optTrip.get(v.option_id);
    if (t) voters.set(t, (voters.get(t) || new Set()).add(v.member_id));
  }
  const size = new Map<string, number>(), flown = new Map<string, number>();
  for (const m of members) {
    size.set(m.trip_id, (size.get(m.trip_id) || 0) + 1);
    if (m.flight_price !== null) flown.set(m.trip_id, (flown.get(m.trip_id) || 0) + 1);
  }
  const lockedKinds = new Map<string, Set<string>>();
  const rounds = new Map<string, { n: number; booked: number }>();
  for (const o of options) {
    if (!o.locked) continue;
    lockedKinds.set(o.trip_id, (lockedKinds.get(o.trip_id) || new Set()).add(o.kind));
    if (o.kind === 'round') {
      const r = rounds.get(o.trip_id) || { n: 0, booked: 0 };
      r.n++;
      if ((o.data as { booked?: boolean })?.booked) r.booked++;
      rounds.set(o.trip_id, r);
    }
  }
  const reached = (id: string, key: string): boolean => {
    const n = size.get(id) || 0;
    const k = lockedKinds.get(id);
    switch (key) {
      case 'created': return true;
      case 'joined': return n >= 2;
      case 'three': return n >= 3;
      case 'voting': return (voters.get(id)?.size || 0) >= 2;
      case 'date': case 'destination': case 'lodging': case 'round': return !!k?.has(key);
      case 'booked': { const r = rounds.get(id); return !!r && r.booked === r.n; }
      case 'flights': return n > 0 && (flown.get(id) || 0) >= n / 2;
      default: return false;
    }
  };
  return steps.map((s) => ({ ...s, trips: [...ids].filter((id) => reached(id, s.key)).length }));
}
