import { handle, loadState, memberFromRequest, tripByCode } from '@/lib/server';

export const dynamic = 'force-dynamic';

// Everything the trip screen needs. Anyone with the link can see the trip; joining is needed to vote.
export function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const trip = await tripByCode(code);
    const me = await memberFromRequest(req, trip.id);
    return Response.json(await loadState(trip, me), { headers: { 'Cache-Control': 'no-store' } });
  });
}
