import { PROFILE_COLS, profileComplete, profileFromRequest } from '@/lib/auth';
import { airport, bed, body, db, handle, int, str } from '@/lib/server';
import type { MyTrip } from '@/lib/shared';

export const dynamic = 'force-dynamic';

// The signed-in person's profile and their trips.
export function GET(req: Request) {
  return handle(async () => {
    const profile = await profileFromRequest(req, true);
    const { data: rows, error } = await db().from('members').select('is_organizer, trips(id,code,name,nights,created_at)').eq('profile_id', profile.id);
    if (error) throw error;
    type Row = { is_organizer: boolean; trips: { id: string; code: string; name: string; nights: number; created_at: string } | null };
    const list = ((rows || []) as unknown as Row[]).filter((r) => r.trips);
    const ids = list.map((r) => r.trips!.id);

    const picks = new Map<string, { start?: string; nights?: number; destination?: string; members: number }>();
    if (ids.length) {
      const [opts, mems] = await Promise.all([
        db().from('options').select('trip_id,kind,data').in('trip_id', ids).eq('locked', true).in('kind', ['date', 'destination']),
        db().from('members').select('trip_id').in('trip_id', ids),
      ]);
      for (const id of ids) picks.set(id, { members: (mems.data || []).filter((m) => m.trip_id === id).length });
      for (const o of (opts.data || []) as { trip_id: string; kind: string; data: { start?: string; nights?: number; name?: string } }[]) {
        const p = picks.get(o.trip_id)!;
        if (o.kind === 'date') { p.start = o.data.start; p.nights = o.data.nights; }
        if (o.kind === 'destination') p.destination = o.data.name;
      }
    }
    const trips: MyTrip[] = list
      .sort((a, b) => b.trips!.created_at.localeCompare(a.trips!.created_at))
      .map((r) => {
        const p = picks.get(r.trips!.id);
        return { code: r.trips!.code, name: r.trips!.name, nights: p?.nights || r.trips!.nights, start: p?.start || null, destination: p?.destination || null, members: p?.members || 1, organizer: r.is_organizer };
      });
    return Response.json({ profile, complete: profileComplete(profile), trips }, { headers: { 'Cache-Control': 'no-store' } });
  });
}

// Update the profile. Name, airport, budget and bed also update the person on every trip they're in.
export function POST(req: Request) {
  return handle(async () => {
    const me = await profileFromRequest(req, true);
    const b = await body(req);
    if (!('name' in b) && typeof b.email_updates === 'boolean') {
      // Just the trip-emails switch.
      const { data, error } = await db().from('profiles').update({ email_updates: b.email_updates }).eq('id', me.id).select(PROFILE_COLS).single();
      if (error) throw error;
      return Response.json({ profile: data, complete: profileComplete(data) });
    }
    const next = {
      name: str(b.name, 60) || me.name,
      phone: str(b.phone, 30).replace(/[^\d+()\-\s.]/g, ''),
      home_city: str(b.home_city, 80),
      airport: airport(b.airport) || me.airport,
      budget: int(b.budget, 0, 100000, me.budget),
      bed: bed(b.bed),
    };
    const { data, error } = await db().from('profiles').update(next).eq('id', me.id).select(PROFILE_COLS).single();
    if (error) throw error;
    await db().from('members').update({ name: next.name, airport: next.airport, budget: next.budget, bed: next.bed }).eq('profile_id', me.id);
    return Response.json({ profile: data, complete: profileComplete(data) });
  });
}
