import { profileComplete, profileFromRequest } from '@/lib/auth';
import { airport, bed, body, db, handle, HttpError, int, ipKey, newCode, newToken, rateLimit, str } from '@/lib/server';

// Create a trip. The creator becomes the organizer: from their profile if signed in, otherwise as a guest.
export function POST(req: Request) {
  return handle(async () => {
    const me = await profileFromRequest(req);
    await rateLimit(`trip-create:${me ? me.id : ipKey(req)}`, 10, 60, 'You’ve started a lot of trips in the last hour. Try again later.');
    const b = await body(req);
    const tripName = str(b.tripName, 80);
    if (!tripName) throw new HttpError(400, 'Give the trip a name.');

    let person: Record<string, unknown>;
    if (me) {
      if (!profileComplete(me)) throw new HttpError(400, 'Finish your profile first: your name and home airport.');
      person = { name: me.name, airport: me.airport, budget: me.budget, bed: me.bed, profile_id: me.id };
    } else {
      const name = str(b.name, 60);
      if (!name) throw new HttpError(400, 'Enter your name.');
      person = { name, airport: airport(b.airport), budget: int(b.budget, 0, 100000, 0), bed: bed(b.bed) };
    }

    const code = newCode();
    const { data: trip, error } = await db().from('trips').insert({ code, name: tripName, nights: int(b.nights, 1, 10, 3) }).select('id').single();
    if (error) throw error;

    const token = newToken();
    const m = await db().from('members').insert({ trip_id: trip.id, token, is_organizer: true, ...person });
    if (m.error) throw m.error;
    return Response.json({ code, token });
  });
}
