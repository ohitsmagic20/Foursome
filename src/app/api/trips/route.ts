import { airport, bed, body, db, handle, HttpError, int, newCode, newToken, str } from '@/lib/server';

// Create a trip. The person creating it becomes the organizer.
export function POST(req: Request) {
  return handle(async () => {
    const b = await body(req);
    const tripName = str(b.tripName, 80);
    const name = str(b.name, 60);
    if (!tripName) throw new HttpError(400, 'Give the trip a name.');
    if (!name) throw new HttpError(400, 'Enter your name.');

    const code = newCode();
    const { data: trip, error } = await db()
      .from('trips')
      .insert({ code, name: tripName, nights: int(b.nights, 1, 10, 3), deposit: int(b.deposit, 0, 100000, 0) })
      .select('id')
      .single();
    if (error) throw error;

    const token = newToken();
    const m = await db().from('members').insert({
      trip_id: trip.id,
      token,
      name,
      airport: airport(b.airport),
      budget: int(b.budget, 0, 100000, 0),
      bed: bed(b.bed),
      is_organizer: true,
    });
    if (m.error) throw m.error;

    return Response.json({ code, token });
  });
}
