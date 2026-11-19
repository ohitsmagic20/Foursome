import 'server-only';
import type { Cup, Games, TripGolf } from './shared';
import { tripGolf } from './shared';
import { db } from './server';

/**
 * Golf on every trip these people played, linked by their profile (signed-in only).
 * Returns profile id → trips, newest first. `skipTrip` leaves one trip out (the one being looked at).
 */
export async function golfHistory(profileIds: string[], skipTrip?: string): Promise<Map<string, TripGolf[]>> {
  const out = new Map<string, TripGolf[]>(profileIds.map((p) => [p, []]));
  if (!profileIds.length) return out;
  const { data: mine } = await db().from('members').select('id,profile_id,trip_id').in('profile_id', profileIds).limit(2000);
  const tripIds = [...new Set((mine || []).map((m) => m.trip_id as string))].filter((t) => t !== skipTrip);
  if (!tripIds.length) return out;
  // The cup and side games columns come from later database updates; read what's there.
  let trips: { id: string; code: string; name: string; cup?: Cup | null; games?: Games | null }[] = [];
  for (const cols of ['id,code,name,cup,games', 'id,code,name,cup', 'id,code,name']) {
    const r = await db().from('trips').select(cols).in('id', tripIds);
    if (!r.error) { trips = (r.data || []) as unknown as typeof trips; break; }
  }
  const [allMembers, dates] = await Promise.all([
    db().from('members').select('id,profile_id,trip_id').in('trip_id', tripIds),
    db().from('options').select('trip_id,data').in('trip_id', tripIds).eq('kind', 'date').eq('locked', true),
  ]);
  const pid = new Map<string, string>();
  for (const m of allMembers.data || []) if (m.profile_id) pid.set(m.id as string, m.profile_id as string);
  const start = new Map<string, string>();
  for (const o of dates.data || []) start.set(o.trip_id as string, String((o.data as { start?: string }).start || ''));
  for (const m of mine || []) {
    const t = trips.find((x) => x.id === m.trip_id);
    if (!t) continue;
    const g = tripGolf({ code: t.code, name: t.name, start: start.get(t.id) || null, cup: t.cup, games: t.games }, m.id as string, pid);
    if (g) out.get(m.profile_id as string)!.push(g);
  }
  for (const list of out.values()) list.sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  return out;
}
