import type { DestinationData } from '@/lib/shared';
import { destAirports } from '@/lib/shared';
import { airportCoords, miles } from '@/lib/geo';
import { handle, loadState, memberFromRequest, tripByCode } from '@/lib/server';
import { TEMPLATES } from '@/data/templates';

export const dynamic = 'force-dynamic';

/** Rough door-to-gate flight time for a distance: cruise plus taxi and climb. Nonstop or not isn't known. */
const flightHours = (mi: number) => Math.round((mi / 460 + 0.6) * 2) / 2;

// Side-by-side numbers for each suggested destination: how far everyone has to fly, and typical costs
// when the place matches one of our trip ideas.
export function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const { code } = await params;
    const trip = await tripByCode(code);
    await memberFromRequest(req, trip.id, true);
    const state = await loadState(trip, null);
    const dests = state.options.filter((o) => o.kind === 'destination');
    const rows = dests.map((o) => {
      const d = o.data as unknown as DestinationData;
      const ports = destAirports(d).map((c) => ({ code: c, at: airportCoords(c) })).filter((p) => p.at);
      const legs = state.members
        .map((m) => {
          const home = m.airport ? airportCoords(m.airport) : null;
          if (!home || !ports.length) return null;
          const best = ports.map((p) => ({ code: p.code, mi: miles(home.lat, home.lon, p.at!.lat, p.at!.lon) })).sort((a, b) => a.mi - b.mi)[0];
          return { id: m.id, name: m.name, from: m.airport, to: best.code, miles: Math.round(best.mi), hours: best.mi < 150 ? 0 : flightHours(best.mi) };
        })
        .filter((x): x is NonNullable<typeof x> => !!x);
      const flying = legs.filter((l) => l.hours > 0);
      const longest = flying.slice().sort((a, b) => b.miles - a.miles)[0] || null;
      const key = d.name.toLowerCase().split(',')[0].trim();
      const tpl = TEMPLATES.find((t) => t.destination.toLowerCase().split(',')[0].trim() === key);
      const fees = tpl?.rounds.map((r) => r.fee) || [];
      return {
        id: o.id,
        name: d.name,
        avgHours: flying.length ? Math.round((flying.reduce((s, l) => s + l.hours, 0) / flying.length) * 2) / 2 : null,
        driving: legs.filter((l) => l.hours === 0).length,
        longest: longest ? { name: longest.name.split(/\s+/)[0], from: longest.from, hours: longest.hours } : null,
        counted: legs.length,
        golf: fees.length ? { low: Math.min(...fees.map((f) => f.low)), high: Math.max(...fees.map((f) => f.high)), idea: tpl!.slug } : null,
        stayPerNight: tpl ? { low: tpl.lodging.perNight.low, high: tpl.lodging.perNight.high } : null,
      };
    });
    return Response.json({ rows }, { headers: { 'Cache-Control': 'no-store' } });
  });
}
