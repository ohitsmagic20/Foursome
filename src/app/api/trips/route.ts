import { profileComplete, profileFromRequest } from '@/lib/auth';
import { airport, bed, body, db, handle, HttpError, int, ipKey, newCode, newToken, rateLimit, str } from '@/lib/server';
import { typicalFee } from '@/data/templates';
import { ideaBySlug } from '@/lib/ideas';

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
      person = { name: me.name, airport: me.airport, budget: me.budget, bed: me.bed, venmo: me.venmo || '', cashapp: me.cashapp || '', profile_id: me.id };
    } else {
      const name = str(b.name, 60);
      if (!name) throw new HttpError(400, 'Enter your name.');
      person = { name, airport: airport(b.airport), budget: int(b.budget, 0, 100000, 0), bed: bed(b.bed) };
    }

    const code = newCode();
    const { data: trip, error } = await db().from('trips').insert({ code, name: tripName, nights: int(b.nights, 1, 10, 3) }).select('id').single();
    if (error) throw error;

    const token = newToken();
    const m = await db().from('members').insert({ trip_id: trip.id, token, is_organizer: true, ...person }).select('id').single();
    if (m.error) throw m.error;

    // Started from a trip idea: add its destination and rounds as suggestions (not locked), with the organizer's yes.
    const tpl = b.template ? await ideaBySlug(str(b.template, 60)) : null;
    if (tpl) {
      const days = int(b.nights, 1, 10, 3) + 1;
      const rows = [
        { kind: 'destination', data: { name: tpl.destination, airport: tpl.airports[0], airports: tpl.airports } },
        ...tpl.rounds.map((r) => ({
          kind: 'round',
          data: {
            course: r.course, day: Math.min(r.day, days), time: r.time, fee: typicalFee(r.fee), booked: false,
            checked: r.fee.verified ? `${r.fee.asOf} (trip idea)` : 'estimate (trip idea)', checkedAt: '', weekday: -1,
            url: r.url || '', fromTemplate: tpl.slug,
            ...(r.courseId ? { courseId: r.courseId } : {}),
          },
        })),
      ].map((o) => ({ ...o, trip_id: trip.id, created_by: m.data.id }));
      const { data: opts, error: oErr } = await db().from('options').insert(rows).select('id');
      if (oErr) throw oErr;
      if (opts?.length) await db().from('votes').insert(opts.map((o) => ({ option_id: o.id, member_id: m.data.id, value: 'yes' })));
    }
    return Response.json({ code, token });
  });
}
