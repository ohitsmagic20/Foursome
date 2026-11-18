'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

import type { CourseInfo } from '@/lib/shared';
import { driveLabel, legOf, useDriveTable, type Pt } from './drive';

/** `search` is a different name to look up on the map; `courseId` is a course picked from the database. */
export interface Stop { name: string; label: string; search?: string; courseId?: string; /** Trip day, so each day's lines start from the stay. */ day?: number }
/** A place to stay, drawn as a house pin (not joined to the route). */
export interface Home { label: string; name: string; lat: number; lon: number }
export type MapCourse = Partial<Omit<CourseInfo, 'name' | 'lat' | 'lon'>> & { name: string; lat: number; lon: number };
interface MapData { center: { lat: number; lon: number }; airport: { code: string; lat: number; lon: number } | null; courses: MapCourse[] }

/* One request per trip for the map and the round cards: the answer is shared and kept for the visit. */
const cache = new Map<string, Promise<MapData>>();
function mapUrl(place: string, airport: string | undefined, stops: Stop[]) {
  const q = new URLSearchParams({ place });
  if (airport) q.set('airport', airport);
  const names = [...new Set(stops.map((s) => (s.courseId ? `${s.name}::id:${s.courseId}` : s.search ? `${s.name}::${s.search}` : s.name)))];
  names.forEach((n) => q.append('course', n));
  return `/api/map?${q}`;
}
/** Course locations and details (type, rating, slope) for a trip's rounds. */
export function useTripCourses(place: string | undefined, airport: string | undefined, stops: Stop[]) {
  const url = place ? mapUrl(place, airport, stops) : '';
  const [state, setState] = useState<{ data: MapData | null; failed: boolean }>({ data: null, failed: false });
  useEffect(() => {
    if (!url) { setState({ data: null, failed: false }); return; }
    if (!cache.has(url)) {
      const p = fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('map'))));
      p.catch(() => cache.delete(url));
      cache.set(url, p);
    }
    let live = true;
    setState((s) => ({ data: s.data, failed: false }));
    cache.get(url)!.then((data) => live && setState({ data, failed: false }), () => live && setState({ data: null, failed: true }));
    return () => { live = false; };
  }, [url]);
  return state;
}

const R = 3958.8;
function miles(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Straight-line distance stretched to a rough road distance. */
const straightClose = (a: Pt, b: Pt) => Math.abs(a.lat - b.lat) < 0.002 && Math.abs(a.lon - b.lon) < 0.002;
const homeIcon = <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /></svg>;

export const roadMiles = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => Math.max(1, Math.round(miles(a, b) * 1.25));

/** A small map of the trip: the arrival airport and each course in playing order, joined by dashed lines. */
/**
 * `lines`: 'days' (Golf tab) draws each day from the stay to its first course, then course to course that day;
 * 'airport' (Stay tab) draws the airport to each stay.
 */
export function TripMap({ place, airport, stops, data: given, homes = [], legs: showLegs = true, lines = 'days' }: { place: string; airport?: string; stops: Stop[]; data?: MapData | null; homes?: Home[]; legs?: boolean; lines?: 'days' | 'airport' }) {
  const el = useRef<HTMLDivElement>(null);
  const own = useTripCourses(given === undefined ? place : undefined, airport, stops);
  const data = given === undefined ? own.data : given;
  const failed = given === undefined && own.failed;

  // Stops in order, with coordinates where the course was found.
  const placed = data ? stops.map((s) => ({ ...s, at: data.courses.find((c) => c.name === s.name) || null })) : [];
  // The day-by-day legs: each day starts at the stay (if there is one) and goes course to course.
  const homeOne = homes.length === 1 ? homes[0] : null;
  const apPt = data?.airport ? { lat: data.airport.lat, lon: data.airport.lon } : null;
  type DayLeg = { from: Pt; to: Pt; fromName: string | null; stopIdx: number };
  const dayLegs: (DayLeg | null)[] = [];
  {
    let prev: { at: Pt; name: string } | null = null, prevDay: number | undefined;
    placed.forEach((p, i) => {
      if (!p.at) { dayLegs.push(null); return; }
      if (i === 0 || p.day !== prevDay) prev = homeOne ? { at: homeOne, name: '' } : null; // a new day starts at the stay
      dayLegs.push(prev ? { from: prev.at, to: p.at, fromName: prev.name || null, stopIdx: i } : null);
      prev = { at: p.at, name: p.name }; prevDay = p.day;
    });
  }
  // Drive times for those legs, plus airport → stay.
  const driveFrom: Pt[] = [...dayLegs.filter(Boolean).map((l) => l!.from), ...(homeOne && apPt ? [apPt] : [])];
  const driveTo: Pt[] = [...dayLegs.filter(Boolean).map((l) => l!.to), ...(homeOne && apPt ? [homeOne] : [])];
  // One row per leg: ask for the full grid and read the diagonal.
  const drive = useDriveTable(driveFrom, driveTo);
  const path = [...(data?.airport ? [{ label: data.airport.code, at: data.airport }] : []), ...placed.filter((p) => p.at).map((p) => ({ label: p.label, at: p.at! }))];

  useEffect(() => {
    if (!data || !el.current || !(path.length || homes.length)) return;
    let map: import('leaflet').Map | null = null;
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, { zoomSnap: 0.25, zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: true, tap: false } as L.MapOptions);
      map.attributionControl.setPrefix(false);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 16, attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>' }).addTo(map);
      const route = path.map((p) => L.latLng(p.at.lat, p.at.lon));
      const pts = [...route, ...homes.map((h) => L.latLng(h.lat, h.lon))];
      // Lines: with one stay, spokes from the stay to each course (and a lighter one to the airport),
      // matching the "from the stay" list. Several stays (the Stay tab): no lines. No stay: the route in order.
      const line = { color: '#1e5a3b', weight: 2.5, dashArray: '6 6', opacity: 0.9 };
      type Leg = { a: [number, number]; b: [number, number]; airport: boolean };
      const legsToDraw: Leg[] = [];
      const seen = new Set<string>();
      const addLeg = (a: { lat: number; lon: number }, b: { lat: number; lon: number }, airport: boolean) => {
        const k = `${a.lat.toFixed(4)},${a.lon.toFixed(4)}>${b.lat.toFixed(4)},${b.lon.toFixed(4)}`;
        if (seen.has(k) || (Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lon - b.lon) < 1e-4)) return; // a course played twice: one line
        seen.add(k); legsToDraw.push({ a: [a.lat, a.lon], b: [b.lat, b.lon], airport });
      };
      if (lines === 'airport') { if (data.airport) homes.forEach((h) => addLeg(data.airport!, h, false)); }
      else dayLegs.forEach((l) => l && addLeg(l.from, l.to, false));
      // Straight dashed lines right away; swapped for the real roads once the routes come back.
      const style = (l: Leg) => (l.airport ? { ...line, color: '#5b6a61', opacity: 0.6, dashArray: '2 6' } : line);
      const straight = legsToDraw.map((l) => L.polyline([l.a, l.b], style(l)).addTo(map!));
      if (legsToDraw.length) {
        const q = legsToDraw.map((l) => `${l.a[0].toFixed(5)},${l.a[1].toFixed(5)};${l.b[0].toFixed(5)},${l.b[1].toFixed(5)}`).join('|');
        fetch(`/api/route?legs=${encodeURIComponent(q)}`).then((r) => (r.ok ? r.json() : null)).then((j: { legs: ([number, number][] | null)[] } | null) => {
          const mm = map;
          if (cancelled || !mm || !j) return;
          j.legs.forEach((coords, i) => {
            if (!coords || !straight[i]) return;
            straight[i].remove();
            const l = legsToDraw[i];
            // Roads: a white casing under a solid line, so it reads on top of the map's own roads.
            L.polyline(coords, { color: '#ffffff', weight: l.airport ? 5 : 6, opacity: 0.85 }).addTo(mm);
            L.polyline(coords, { color: l.airport ? '#5b6a61' : '#1e5a3b', weight: l.airport ? 2.5 : 3.5, opacity: l.airport ? 0.7 : 0.95, dashArray: l.airport ? '4 6' : undefined }).addTo(mm);
          });
        }).catch(() => {});
      }
      // Stops within about half a mile (the same course, or courses at one resort) share one pin with every number on it.
      const pins: { at: { lat: number; lon: number }; labels: string[]; airport: boolean }[] = [];
      const markers: L.Marker[] = [];
      path.forEach((p, i) => {
        const isAirport = !!data.airport && i === 0;
        const near = !isAirport && pins.find((e) => !e.airport && miles(e.at, p.at) < 0.6);
        if (near) near.labels.push(p.label);
        else pins.push({ at: p.at, labels: [p.label], airport: isAirport });
      });
      // A stay at a course (a resort's own course) shares that pin: "⌂ 3".
      const homeLabels = homes.map(() => [] as string[]);
      for (let k = pins.length - 1; k >= 0; k--) {
        const e = pins[k];
        if (e.airport) continue;
        const hi = homes.findIndex((h) => miles(h, e.at) < 0.4);
        if (hi >= 0) { homeLabels[hi].unshift(...e.labels); pins.splice(k, 1); }
      }
      for (const e of pins) {
        const html = `<span class="pin${e.airport ? ' pin-airport' : ''}">${e.labels.join(' ')}</span>`;
        markers.push(L.marker([e.at.lat, e.at.lon], { icon: L.divIcon({ className: '', html, iconSize: undefined as unknown as L.PointExpression }), keyboard: false }).addTo(map));
      }
      // Stays: a house pin each, on top of the course pins.
      homes.forEach((h, hi) => {
        const extra = homeLabels[hi].length ? `<b class="pin-also">${homeLabels[hi].join(' ')}</b>` : '';
        const html = `<span class="pin pin-home" title="${h.name.replace(/[<>"&]/g, '')}"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>${h.label}${extra}</span>`;
        markers.push(L.marker([h.lat, h.lon], { icon: L.divIcon({ className: '', html, iconSize: undefined as unknown as L.PointExpression }), keyboard: false, zIndexOffset: 500 }).addTo(map!));
      });
      map.invalidateSize();
      // Fit tightly (quarter zoom steps), leaving room around the edges for the pins.
      if (pts.length === 1) map.setView(pts[0], 12);
      else map.fitBounds(L.latLngBounds(pts), { maxZoom: 13, paddingTopLeft: [30, homes.length ? 48 : 30], paddingBottomRight: [30, 30] });
      // Pins that land on top of each other at this zoom get nudged apart, so every number and house shows.
      const m = map;
      const spread = () => {
        const placedPx: { x: number; y: number }[] = [];
        // Houses first: lines start at the stay, so it keeps its spot and the course pins move aside.
        const order = [...markers.slice(markers.length - homes.length), ...markers.slice(0, markers.length - homes.length)];
        const steps = [[0, 0], [28, 0], [-28, 0], [0, 26], [0, -26], [28, 26], [-28, 26], [28, -26], [-28, -26]];
        for (const mk of order) {
          const pin = mk.getElement()?.firstElementChild as HTMLElement | null;
          if (!pin) continue;
          pin.style.translate = '';
          const p = m.latLngToContainerPoint(mk.getLatLng());
          const free = steps.find(([sx, sy]) => !placedPx.some((q) => Math.abs(q.x - (p.x + sx)) < 30 && Math.abs(q.y - (p.y + sy)) < 24)) || [0, 0];
          const [dx, dy] = free;
          if (dx || dy) pin.style.translate = `${dx}px ${dy}px`;
          placedPx.push({ x: p.x + dx, y: p.y + dy });
        }
      };
      spread();
      m.on('zoomend', spread);
    });
    return () => { cancelled = true; map?.remove(); };
  }, [data, homes.map((h) => `${h.label}${h.lat},${h.lon}`).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  if ((!stops.length && !homes.length) || failed) return null;
  // The list under the map: each course's drive from where that day's previous stop was.
  const legs: { label: string; name: string; text: string }[] = [];
  let d = 0;
  placed.forEach((p, i) => {
    const l = dayLegs[i];
    if (!p.at) { legs.push({ label: p.label, name: p.name, text: 'not on map' }); return; }
    if (!l) { legs.push({ label: p.label, name: p.name, text: '' }); return; }
    const t = legOf(drive, d, d, l.from, l.to); d++;
    const same = straightClose(l.from, l.to);
    legs.push({ label: p.label, name: p.name, text: same ? (l.fromName ? 'same course' : 'at the stay') : `${t.est ? '~' : ''}${driveLabel(t.min)} from ${l.fromName ? (l.fromName.split('(')[0].trim().length <= 20 ? l.fromName.split('(')[0].trim() : 'the morning course') : 'the stay'}` });
  });
  const home = homeOne;
  const apToHome = home && apPt ? legOf(drive, d, d, apPt, home) : null;
  return (
    <section className="trip-map">
      <div ref={el} className="trip-map-canvas" aria-label={`Map of ${place} with the courses in order`}>
        {!data && <span className="trip-map-loading">Loading map…</span>}
      </div>
      {data && showLegs && (
        <ol className="trip-map-legs">
          {data.airport && <li><span className="pin pin-airport">{data.airport.code}</span><span className="grow">Arrive</span>{apToHome && <span className="row-meta leg-time">{apToHome.est ? '~' : ''}{driveLabel(apToHome.min)} to the stay</span>}</li>}
          {home && <li><span className="pin pin-home">{homeIcon}</span><span className="grow">{home.name}</span><span className="row-meta">the stay</span></li>}
          {legs.map((l, i) => (
            <li key={i}>
              <span className="pin">{l.label}</span>
              <span className="grow">{l.name}</span>
              <span className="row-meta leg-time">{l.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
