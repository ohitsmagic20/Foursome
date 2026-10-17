import { profileComplete, profileFromRequest } from '@/lib/auth';
import { body, db, handle, HttpError, int, newCode, newToken, str } from '@/lib/server';

// Create a trip. The signed-in person becomes the organizer, using their profile details.
export function POST(req: Request) {
  return handle(async () => {
    const me = await profileFromRequest(req, true);
    if (!profileComplete(me)) throw new HttpError(400, 'Finish your profile first: your name and home airport.');
    const b = await body(req);
    const tripName = str(b.tripName, 80);
    if (!tripName) throw new HttpError(400, 'Give the trip a name.');

    const code = newCode();
    const { data: trip, error } = await db()
      .from('trips')
      .insert({ code, name: tripName, nights: int(b.nights, 1, 10, 3), deposit: int(b.deposit, 0, 100000, 0) })
      .select('id')
      .single();
    if (error) throw error;

    const token = newToken();
    const m = await db().from('members').insert({
      trip_id: trip.id, token, name: me.name, airport: me.airport, budget: me.budget, bed: me.bed, is_organizer: true, profile_id: me.id,
    });
    if (m.error) throw m.error;
    return Response.json({ code, token });
  });
}
