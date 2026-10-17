import { profileComplete, profileFromRequest } from '@/lib/auth';
import { db, handle, HttpError, newToken, tripByCode } from '@/lib/server';

const MAX_MEMBERS = 40;

// Join a trip with your account. Joining twice just returns your existing spot.
export function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const trip = await tripByCode(code);
    const me = await profileFromRequest(req, true);
    if (!profileComplete(me)) throw new HttpError(400, 'Finish your profile first: your name and home airport.');

    const existing = await db().from('members').select('id,token').eq('trip_id', trip.id).eq('profile_id', me.id).maybeSingle();
    if (existing.data) return Response.json({ token: existing.data.token });

    const { count } = await db().from('members').select('id', { count: 'exact', head: true }).eq('trip_id', trip.id);
    if ((count || 0) >= MAX_MEMBERS) throw new HttpError(400, `This trip already has ${MAX_MEMBERS} people.`);

    const token = newToken();
    const { error } = await db().from('members').insert({
      trip_id: trip.id, token, name: me.name, airport: me.airport, budget: me.budget, bed: me.bed, profile_id: me.id,
    });
    if (error) throw error;
    return Response.json({ token });
  });
}
