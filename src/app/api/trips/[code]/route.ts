import { calendarKey, db, handle, loadState, memberFromRequest, tripByCode } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Everything the trip screen needs, for people on the trip. Anyone else with the link only sees
// the trip name, who's organizing and how many are going, so budgets and plans stay private.
export function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const trip = await tripByCode(code);
    const me = await memberFromRequest(req, trip.id);
    if (!me) {
      const { data } = await db().from('members').select('name,is_organizer').eq('trip_id', trip.id);
      const org = (data || []).find((m) => m.is_organizer);
      return Response.json({
        trip: { id: '', code: trip.code, name: trip.name, nights: trip.nights, food: 0 },
        members: [], options: [], votes: [], meId: null,
        preview: { organizer: org ? String(org.name).split(/\s+/)[0] : '', count: (data || []).length },
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const state = await loadState(trip, me);
    const { data: t } = await db().from('members').select('token').eq('id', me.id).single();
    const flightSearch = (process.env.DUFFEL_ACCESS_TOKEN || '').startsWith('duffel_live') || process.env.FLIGHT_SEARCH_TEST === '1';
    return Response.json({ ...state, calKey: t ? calendarKey(t.token) : undefined, flightSearch }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
