import type { DateData, DestinationData, FlightLeg, FlightOffer } from '@/lib/shared';
import { addDays, isoDay, parseDay, pickOf } from '@/lib/shared';
import { airport, body, handle, HttpError, loadState, memberFromRequest, tripByCode } from '@/lib/server';

export const maxDuration = 60;

interface DuffelSegment {
  departing_at: string;
  arriving_at: string;
  origin: { iata_code: string };
  destination: { iata_code: string };
  marketing_carrier?: { name?: string };
  operating_carrier?: { name?: string };
}
interface DuffelOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  owner?: { name?: string };
  slices: { segments: DuffelSegment[] }[];
}

function leg(slice: { segments: DuffelSegment[] } | undefined): FlightLeg | null {
  if (!slice || !slice.segments?.length) return null;
  const first = slice.segments[0], last = slice.segments[slice.segments.length - 1];
  return {
    depart: first.departing_at,
    arrive: last.arriving_at,
    from: first.origin.iata_code,
    to: last.destination.iata_code,
    stops: slice.segments.length - 1,
    carrier: first.operating_carrier?.name || first.marketing_carrier?.name || '',
  };
}

// Search round-trip flights for the person asking, from their home airport, for the trip's dates.
export function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return handle(async () => {
    const token = process.env.DUFFEL_ACCESS_TOKEN;
    if (!token) throw new HttpError(503, 'Flight search is not set up yet. Add DUFFEL_ACCESS_TOKEN to the server environment.');

    const { code } = await params;
    const trip = await tripByCode(code);
    const me = await memberFromRequest(req, trip.id, true);
    const b = await body(req);
    const state = await loadState(trip, me);

    const date = pickOf<DateData>(state, 'date').option;
    const dest = pickOf<DestinationData>(state, 'destination').option;
    if (!date) throw new HttpError(400, 'Add date options first so there are dates to search.');
    if (!dest?.data.airport) throw new HttpError(400, 'The destination needs an airport code, like MYR for Myrtle Beach. Edit it on the Vote tab.');
    const origin = airport(b.origin) || me.airport;
    if (!origin) throw new HttpError(400, 'Add your home airport first.');
    if (origin === dest.data.airport) throw new HttpError(400, 'Your home airport is the destination airport.');

    const outDate = date.data.start;
    const backDate = isoDay(addDays(parseDay(outDate), trip.nights));

    const res = await fetch('https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=20000', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Duffel-Version': 'v2',
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        data: {
          slices: [
            { origin, destination: dest.data.airport, departure_date: outDate },
            { origin: dest.data.airport, destination: origin, departure_date: backDate },
          ],
          passengers: [{ type: 'adult' }],
          cabin_class: 'economy',
          max_connections: 1,
        },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.errors?.[0]?.message || `Flight search failed (${res.status}).`;
      throw new HttpError(502, msg);
    }

    const offers: FlightOffer[] = ((json?.data?.offers || []) as DuffelOffer[])
      .map((o) => {
        const out = leg(o.slices[0]);
        if (!out) return null;
        return {
          id: o.id,
          price: Number(o.total_amount),
          currency: o.total_currency,
          airline: o.owner?.name || out.carrier,
          out,
          back: leg(o.slices[1]),
        } as FlightOffer;
      })
      .filter((x): x is FlightOffer => !!x)
      .sort((a, b) => a.price - b.price);

    // Keep the cheapest few, plus the earliest arrival, which matters for a same-day tee time.
    const top = offers.slice(0, 8);
    const earliest = offers.slice().sort((a, b) => a.out.arrive.localeCompare(b.out.arrive))[0];
    if (earliest && !top.some((o) => o.id === earliest.id)) top.push(earliest);

    return Response.json({
      query: { origin, destination: dest.data.airport, outDate, backDate, datesLocked: date.locked, destLocked: !!dest.locked },
      offers: top,
      testMode: token.startsWith('duffel_test'),
    });
  });
}
