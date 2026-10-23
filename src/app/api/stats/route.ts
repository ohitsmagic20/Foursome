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
    const { data: errs } = await db().from('app_errors').select('at,source,message,path').order('at', { ascending: false }).limit(25);
    return Response.json({
      trips, trips7, trips30, planned, members, guests, accounts, expenses, shared, errors7,
      groupSize: trips ? Math.round((members / trips) * 10) / 10 : 0,
      weeks, ideas, errors: errs || [],
    }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
