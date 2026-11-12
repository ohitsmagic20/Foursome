'use client';

import type { DestinationData, LodgingData, Option, RoundData } from '@/lib/shared';
import { destAirports, inPlace, teeMinutes } from '@/lib/shared';
import { TripMap, roadMiles, useTripCourses, type Home, type Stop } from './TripMap';
import { useTrip } from './ui';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const has = (o: Option<LodgingData>) => !!(o.data.lat && o.data.lon);

/** The rounds this place's stays are measured against: the ones in the plan, else every suggested round. */
function useCourseStops(dest: Option<DestinationData> | null) {
  const { state } = useTrip();
  const rounds = dest ? inPlace<RoundData>(state, 'round', dest.id) : [];
  const planned = rounds.filter((r) => r.locked);
  const use = (planned.length ? planned : rounds).slice().sort((a, b) => a.data.day - b.data.day || teeMinutes(a.data.time) - teeMinutes(b.data.time));
  const stops: Stop[] = use.map((r, i) => ({ name: r.data.course, label: String(i + 1), courseId: r.data.courseId }));
  const airport = dest ? destAirports(dest.data)[0] : undefined;
  const map = useTripCourses(dest?.data.name, airport, stops);
  return { stops, map, planned: planned.length > 0, airport };
}

export interface StayDistance { letter: string; avg: number | null; max: number | null; airport: number | null; airportCode: string }

/** For each stay: its letter on the map, and how far it is from the courses and the airport. */
export function useStayDistances(dest: Option<DestinationData> | null, stays: Option<LodgingData>[]) {
  const { stops, map } = useCourseStops(dest);
  const out = new Map<string, StayDistance>();
  const courses = map.data ? stops.map((s) => map.data!.courses.find((c) => c.name === s.name)).filter((c): c is NonNullable<typeof c> => !!c) : [];
  let n = 0;
  for (const o of stays) {
    if (!has(o)) { out.set(o.id, { letter: '', avg: null, max: null, airport: null, airportCode: '' }); continue; }
    const at = { lat: o.data.lat!, lon: o.data.lon! };
    const d = courses.map((c) => roadMiles(at, c));
    const ap = map.data?.airport;
    out.set(o.id, {
      letter: LETTERS[n++] || '',
      avg: d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null,
      max: d.length ? Math.max(...d) : null,
      airport: ap ? roadMiles(at, ap) : null, airportCode: ap?.code || '',
    });
  }
  return out;
}

/** The Stay tab's map: each stay as a lettered house pin, with the trip's courses and the airport around it. */
export function StayMap({ dest, stays }: { dest: Option<DestinationData>; stays: Option<LodgingData>[] }) {
  const { stops, map, planned, airport } = useCourseStops(dest);
  const dist = useStayDistances(dest, stays);
  const placed = stays.filter(has);
  if (!placed.length) return null;
  const homes: Home[] = placed.map((o) => ({ label: dist.get(o.id)?.letter || '', name: o.data.name, lat: o.data.lat!, lon: o.data.lon! }));
  const ranked = placed.map((o) => ({ o, d: dist.get(o.id)! })).filter((x) => x.d.avg !== null);
  const best = ranked.length > 1 ? ranked.slice().sort((a, b) => a.d.avg! - b.d.avg!)[0].o.id : '';
  const approx = placed.some((o) => o.data.pin === 'listing' && /airbnb/i.test(o.data.url || ''));
  return (
    <div className="card stay-map">
      <div className="row-title">Where the stays are</div>
      <div className="row-meta" style={{ marginBottom: 8 }}>
        {stops.length ? `Houses are the stays; numbers are the ${planned ? 'rounds in the plan' : 'suggested rounds'}, in order.` : 'Add rounds on the Golf tab to see how far each stay is from the courses.'}
      </div>
      <TripMap place={dest.data.name} airport={airport} stops={stops} data={map.data} homes={homes} legs={false} />
      <ol className="stay-map-list">
        {placed.map((o) => {
          const d = dist.get(o.id)!;
          return (
            <li key={o.id}>
              <span className="pin pin-home">{d.letter}</span>
              <span className="grow" style={{ minWidth: 0 }}>{o.data.name}</span>
              <span className={`row-meta${o.id === best ? ' best' : ''}`}>{d.avg !== null ? `~${d.avg} mi avg` : d.airport !== null ? `${d.airport} mi from ${d.airportCode}` : ''}</span>
            </li>
          );
        })}
      </ol>
      <p className="hint">Rough driving miles. {approx ? 'Airbnb shows an approximate spot until you book. ' : ''}{stays.length > placed.length ? `${stays.length - placed.length} stay${stays.length - placed.length === 1 ? ' isn’t' : 's aren’t'} on the map yet: add an address to place ${stays.length - placed.length === 1 ? 'it' : 'them'}.` : ''}</p>
    </div>
  );
}
