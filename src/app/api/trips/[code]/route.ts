import { calendarKey, db, handle, loadState, memberFromRequest, tripByCode } from '@/lib/server';
import { settleDeadlines } from '@/lib/deadlines';
import { tripPreview } from '@/lib/preview';

export const dynamic = 'force-dynamic';

// Everything the trip screen needs, for people on the trip. Anyone else with the link only sees
// the trip name, who's going (first names) and what's settled, so budgets and votes stay private.
export function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const trip = await tripByCode(code);
    const me = await memberFromRequest(req, trip.id);
    if (!me) {
      return Response.json({
        trip: { id: '', code: trip.code, name: trip.name, nights: trip.nights, food: 0 },
        members: [], options: [], votes: [], meId: null,
        preview: await tripPreview(trip),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    await settleDeadlines(trip).catch(() => false); // a passed voting deadline locks the leader
    const state = await loadState(trip, me);
    const { data: t } = await db().from('members').select('token').eq('id', me.id).single();
    const flightSearch = (process.env.DUFFEL_ACCESS_TOKEN || '').startsWith('duffel_live') || process.env.FLIGHT_SEARCH_TEST === '1';
    return Response.json({ ...state, calKey: t ? calendarKey(t.token) : undefined, flightSearch }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
