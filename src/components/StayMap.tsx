'use client';

import type { DestinationData, LodgingData, Option, RoundData } from '@/lib/shared';
import { destAirports, inPlace, teeMinutes } from '@/lib/shared';
import { TripMap, roadMiles, useTripCourses, type Home, type Stop } from './TripMap';
import { useEffect, useState } from 'react';
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

export interface StayDistance {
  letter: string;
  /** Average and longest drive to the rounds' courses, in minutes and miles (null: not on the map or no courses). */
  avgMin: number | null; maxMin: number | null; avgMi: number | null;
  airportMin: number | null; airportMi: number | null; airportCode: string;
  /** True when the routing service didn't answer and these are estimates from distance. */
  estimated: boolean;
}

type Pt = { lat: number; lon: number };
type Table = { minutes: number[][] | null; miles: number[][] | null };
const tables = new Map<string, Promise<Table>>();
/** Drive times from each stay to each course (shared by every component asking the same question). */
function useDriveTable(from: Pt[], to: Pt[]) {
  const enc = (ps: Pt[]) => ps.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join('|');
  const url = from.length && to.length ? `/api/drive?from=${enc(from)}&to=${enc(to)}` : '';
  const [res, setRes] = useState<{ url: string; t: Table } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    if (!tables.has(url)) tables.set(url, fetch(url).then((r) => (r.ok ? r.json() : { minutes: null, miles: null })).catch(() => ({ minutes: null, miles: null })));
    tables.get(url)!.then((t) => live && setRes({ url, t }));
    return () => { live = false; };
  }, [url]);
  return res && res.url === url ? res.t : null;
}

/** Without routing: miles on the road, at a typical 38 mph plus a few minutes for parking and lights. */
const estMinutes = (mi: number) => Math.round((mi / 38) * 60 + 3);
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** For each stay: its letter on the map, and the drive to the courses and the airport. */
export function useStayDistances(dest: Option<DestinationData> | null, stays: Option<LodgingData>[]) {
  const { stops, map } = useCourseStops(dest);
  // One entry per round (a course played twice counts twice), then the unique spots to route to.
  const courses = map.data ? stops.map((s) => map.data!.courses.find((c) => c.name === s.name)).filter((c): c is NonNullable<typeof c> => !!c) : [];
  const spots: Pt[] = [];
  const idx = courses.map((c) => { let i = spots.findIndex((p) => p.lat === c.lat && p.lon === c.lon); if (i < 0) { spots.push({ lat: c.lat, lon: c.lon }); i = spots.length - 1; } return i; });
  const ap = map.data?.airport;
  const placed = stays.filter(has);
  const table = useDriveTable(placed.map((o) => ({ lat: o.data.lat!, lon: o.data.lon! })), ap ? [...spots, ap] : spots);
  const out = new Map<string, StayDistance>();
  let n = 0;
  for (const o of stays) {
    if (!has(o)) { out.set(o.id, { letter: '', avgMin: null, maxMin: null, avgMi: null, airportMin: null, airportMi: null, airportCode: '', estimated: false }); continue; }
    const row = placed.indexOf(o);
    const at = { lat: o.data.lat!, lon: o.data.lon! };
    const routed = table?.minutes?.[row] && table.miles?.[row] ? { min: table.minutes[row], mi: table.miles[row] } : null;
    // Each round: routed minutes and miles if we have them (and the route exists), else an estimate.
    const leg = (j: number, p: Pt) => (routed && routed.min[j] > 0 ? { min: routed.min[j], mi: routed.mi[j], est: false } : { min: estMinutes(roadMiles(at, p)), mi: roadMiles(at, p), est: true });
    const legs = idx.map((j) => leg(j, spots[j]));
    const apLeg = ap ? leg(spots.length, ap) : null;
    out.set(o.id, {
      letter: LETTERS[n++] || '',
      avgMin: avg(legs.map((l) => l.min)), maxMin: legs.length ? Math.max(...legs.map((l) => l.min)) : null, avgMi: avg(legs.map((l) => l.mi)),
      airportMin: apLeg?.min ?? null, airportMi: apLeg?.mi ?? null, airportCode: ap?.code || '',
      estimated: legs.some((l) => l.est) || !!apLeg?.est,
    });
  }
  return out;
}

/** "25 min", "1 hr 5 min". */
export const driveLabel = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} hr${min % 60 ? ` ${min % 60} min` : ''}`);

/** The Stay tab's map: each stay as a lettered house pin, with the trip's courses and the airport around it. */
export function StayMap({ dest, stays }: { dest: Option<DestinationData>; stays: Option<LodgingData>[] }) {
  const { stops, map, planned, airport } = useCourseStops(dest);
  const dist = useStayDistances(dest, stays);
  const placed = stays.filter(has);
  if (!placed.length) return null;
  const homes: Home[] = placed.map((o) => ({ label: dist.get(o.id)?.letter || '', name: o.data.name, lat: o.data.lat!, lon: o.data.lon! }));
  const ranked = placed.map((o) => ({ o, d: dist.get(o.id)! })).filter((x) => x.d.avgMin !== null);
  const best = ranked.length > 1 ? ranked.slice().sort((a, b) => a.d.avgMin! - b.d.avgMin!)[0].o.id : '';
  const estimated = ranked.some((x) => x.d.estimated);
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
              <span className={`row-meta stay-drive${o.id === best ? ' best' : ''}`}>{d.avgMin !== null ? <><b>{driveLabel(d.avgMin)}</b> avg to golf</> : d.airportMin !== null ? `${driveLabel(d.airportMin)} from ${d.airportCode}` : ''}</span>
            </li>
          );
        })}
      </ol>
      <p className="hint">{estimated ? 'Estimated drive times (the routing service didn’t answer). ' : 'Drive times without traffic, averaged over the rounds. '}{approx ? 'Airbnb shows an approximate spot until you book. ' : ''}{stays.length > placed.length ? `${stays.length - placed.length} stay${stays.length - placed.length === 1 ? ' isn’t' : 's aren’t'} on the map yet: add an address to place ${stays.length - placed.length === 1 ? 'it' : 'them'}.` : ''}</p>
    </div>
  );
}
