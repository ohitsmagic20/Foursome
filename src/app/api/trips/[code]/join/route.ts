import { profileComplete, profileFromRequest } from '@/lib/auth';
import { airport, bed, body, db, handle, HttpError, int, ipKey, newToken, rateLimit, str, tripByCode } from '@/lib/server';

const MAX_MEMBERS = 40;

// Join a trip. Signed in: uses your profile (joining twice returns your existing spot).
// Not signed in: join as a guest with a name; signing in later attaches your account to this spot.
export function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const trip = await tripByCode(code);
    const me = await profileFromRequest(req);

    let row: Record<string, unknown>;
    if (me) {
      if (!profileComplete(me)) throw new HttpError(400, 'Finish your profile first: your name and home airport.');
      const existing = await db().from('members').select('id,token').eq('trip_id', trip.id).eq('profile_id', me.id).maybeSingle();
      if (existing.data) return Response.json({ token: existing.data.token });
      row = { name: me.name, airport: me.airport, budget: me.budget, bed: me.bed, venmo: me.venmo || '', cashapp: me.cashapp || '', profile_id: me.id };
    } else {
      await rateLimit(`guest-join:${ipKey(req)}`, 20, 60, 'Too many joins from this device. Try again in an hour.');
      const b = await body(req);
      const name = str(b.name, 60);
      if (!name) throw new HttpError(400, 'Enter your name.');
      row = { name, airport: airport(b.airport), budget: int(b.budget, 0, 100000, 0), bed: bed(b.bed) };
    }

    const { count } = await db().from('members').select('id', { count: 'exact', head: true }).eq('trip_id', trip.id);
    if ((count || 0) >= MAX_MEMBERS) throw new HttpError(400, `This trip already has ${MAX_MEMBERS} people.`);

    const token = newToken();
    const { error } = await db().from('members').insert({ trip_id: trip.id, token, ...row });
    if (error) throw error;
    return Response.json({ token });
  });
}
