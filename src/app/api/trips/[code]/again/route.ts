import type { DateData, DestinationData, RoundData } from '@/lib/shared';
import { pickOf, plannedRounds } from '@/lib/shared';
import { db, handle, loadState, memberFromRequest, newCode, newToken, rateLimit, tripByCode } from '@/lib/server';

// "Run it back": start next year's trip from this one. Same length and food budget; the place and the
// rounds that were played come over as suggestions with my yes. Only I'm on it; everyone else joins by link.
export function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const old = await tripByCode(code);
    const me = await memberFromRequest(req, old.id, true);
    await rateLimit(`trip-again:${me.id}`, 3, 60, 'You just started one. Check your trips.');
    const state = await loadState(old, me);

    const start = pickOf<DateData>(state, 'date').option?.data.start;
    const year = start ? Number(start.slice(0, 4)) : new Date().getFullYear();
    const name = /\b(19|20)\d{2}\b/.test(old.name)
      ? old.name.replace(/\b((?:19|20)\d{2})\b/, (y) => String(Number(y) + 1))
      : `${old.name} ${year + 1}`.slice(0, 80);

    const newTrip = await db().from('trips').insert({ code: newCode(), name, nights: old.nights, food: old.food }).select('id,code').single();
    if (newTrip.error) throw newTrip.error;
    const token = newToken();
    const { data: full } = await db().from('members').select('name,airport,budget,bed,venmo,cashapp,profile_id').eq('id', me.id).single();
    const m = await db().from('members').insert({ trip_id: newTrip.data.id, token, is_organizer: true, ...(full || { name: me.name, airport: me.airport, budget: me.budget, bed: me.bed }) }).select('id').single();
    if (m.error) throw m.error;

    const dest = pickOf<DestinationData>(state, 'destination').option;
    const rows = [
      ...(dest ? [{ kind: 'destination', data: dest.data }] : []),
      ...plannedRounds(state).map((r) => {
        const d = r.data as RoundData;
        // Last year's booking details don't carry over; the fee is last year's, so say so.
        const { booked: _b, owner: _o, groups: _g, confirmation: _c, ...rest } = d;
        void _b; void _o; void _g; void _c;
        return { kind: 'round', data: { ...rest, booked: false, checked: 'last year’s price', checkedAt: '' } };
      }),
    ].map((o) => ({ ...o, trip_id: newTrip.data.id, created_by: m.data.id }));
    if (rows.length) {
      const { data: opts, error } = await db().from('options').insert(rows).select('id');
      if (error) throw error;
      if (opts?.length) await db().from('votes').insert(opts.map((o) => ({ option_id: o.id, member_id: m.data.id, value: 'yes' })));
    }
    return Response.json({ code: newTrip.data.code, token, name });
  });
}
