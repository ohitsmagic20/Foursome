import { airport, bed, body, db, handle, HttpError, int, newToken, str, tripByCode } from '@/lib/server';

const MAX_MEMBERS = 40;

export function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const trip = await tripByCode(code);
    const b = await body(req);
    const name = str(b.name, 60);
    if (!name) throw new HttpError(400, 'Enter your name.');

    const { count } = await db().from('members').select('id', { count: 'exact', head: true }).eq('trip_id', trip.id);
    if ((count || 0) >= MAX_MEMBERS) throw new HttpError(400, `This trip already has ${MAX_MEMBERS} people.`);

    const token = newToken();
    const { error } = await db().from('members').insert({
      trip_id: trip.id,
      token,
      name,
      airport: airport(b.airport),
      budget: int(b.budget, 0, 100000, 0),
      bed: bed(b.bed),
    });
    if (error) throw error;
    return Response.json({ token });
  });
}
