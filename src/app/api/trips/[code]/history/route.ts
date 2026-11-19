import { golfHistory } from '@/lib/history';
import { db, handle, memberFromRequest, tripByCode } from '@/lib/server';
import { golfTotals } from '@/lib/shared';

export const dynamic = 'force-dynamic';

// For the people on this trip who are signed in: their handicap last time, their record on other trips,
// and, between two people, their head-to-head. Names and other trips' details stay private.
export function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const trip = await tripByCode(code);
    await memberFromRequest(req, trip.id, true);
    const { data: members } = await db().from('members').select('id,profile_id').eq('trip_id', trip.id);
    const linked = (members || []).filter((m) => m.profile_id) as { id: string; profile_id: string }[];
    const hist = await golfHistory(linked.map((m) => m.profile_id), trip.id);
    const people: Record<string, { hcp: number | null; hcpFrom: string | null; trips: number; w: number; l: number; h: number; won: number; lost: number }> = {};
    for (const m of linked) {
      const list = hist.get(m.profile_id) || [];
      const last = list.find((t) => t.hcp !== null);
      const t = golfTotals(list);
      if (!list.length) continue;
      people[m.id] = { hcp: last?.hcp ?? null, hcpFrom: last?.name ?? null, trips: t.trips, w: t.w, l: t.l, h: t.h, won: t.won, lost: t.lost };
    }
    // Head to head, for every pair that has played each other before.
    const h2h: { a: string; b: string; w: number; l: number; h: number }[] = [];
    for (const x of linked) for (const y of linked) {
      if (x.id >= y.id) continue;
      const t = golfTotals(hist.get(x.profile_id) || [], y.profile_id);
      if (t.w + t.l + t.h) h2h.push({ a: x.id, b: y.id, w: t.w, l: t.l, h: t.h });
    }
    return Response.json({ people, h2h });
  });
}
