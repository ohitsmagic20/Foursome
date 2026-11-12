'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

import type { CourseInfo } from '@/lib/shared';

/** `search` is a different name to look up on the map; `courseId` is a course picked from the database. */
export interface Stop { name: string; label: string; search?: string; courseId?: string }
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
export const roadMiles = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => Math.max(1, Math.round(miles(a, b) * 1.25));

/** A small map of the trip: the arrival airport and each course in playing order, joined by dashed lines. */
export function TripMap({ place, airport, stops, data: given, homes = [], legs: showLegs = true }: { place: string; airport?: string; stops: Stop[]; data?: MapData | null; homes?: Home[]; legs?: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  const own = useTripCourses(given === undefined ? place : undefined, airport, stops);
  const data = given === undefined ? own.data : given;
  const failed = given === undefined && own.failed;

  // Stops in order, with coordinates where the course was found.
  const placed = data ? stops.map((s) => ({ ...s, at: data.courses.find((c) => c.name === s.name) || null })) : [];
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
      if (route.length > 1) L.polyline(route, { color: '#1e5a3b', weight: 2.5, dashArray: '6 6', opacity: 0.9 }).addTo(map);
      // Stops within about half a mile (the same course, or courses at one resort) share one pin with every number on it.
      const pins: { at: { lat: number; lon: number }; labels: string[]; airport: boolean }[] = [];
      path.forEach((p, i) => {
        const isAirport = !!data.airport && i === 0;
        const near = !isAirport && pins.find((e) => !e.airport && miles(e.at, p.at) < 0.6);
        if (near) near.labels.push(p.label);
        else pins.push({ at: p.at, labels: [p.label], airport: isAirport });
      });
      for (const e of pins) {
        const html = `<span class="pin${e.airport ? ' pin-airport' : ''}">${e.labels.join(' ')}</span>`;
        L.marker([e.at.lat, e.at.lon], { icon: L.divIcon({ className: '', html, iconSize: undefined as unknown as L.PointExpression }), keyboard: false }).addTo(map);
      }
      // Stays: a house pin each, on top of the course pins.
      for (const h of homes) {
        const html = `<span class="pin pin-home" title="${h.name.replace(/[<>"&]/g, '')}"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>${h.label}</span>`;
        L.marker([h.lat, h.lon], { icon: L.divIcon({ className: '', html, iconSize: undefined as unknown as L.PointExpression }), keyboard: false, zIndexOffset: 500 }).addTo(map);
      }
      map.invalidateSize();
      // Fit tightly (quarter zoom steps), leaving room around the edges for the pins.
      if (pts.length === 1) map.setView(pts[0], 12);
      else map.fitBounds(L.latLngBounds(pts), { maxZoom: 13, padding: [28, 28] });
    });
    return () => { cancelled = true; map?.remove(); };
  }, [data, homes.map((h) => `${h.label}${h.lat},${h.lon}`).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  if ((!stops.length && !homes.length) || failed) return null;
  const legs: { label: string; name: string; from?: number }[] = [];
  let prev = data?.airport ? { lat: data.airport.lat, lon: data.airport.lon } : null;
  for (const p of placed) {
    legs.push({ label: p.label, name: p.name, from: p.at && prev ? roadMiles(prev, p.at) : undefined });
    if (p.at) prev = p.at;
  }
  return (
    <section className="trip-map">
      <div ref={el} className="trip-map-canvas" aria-label={`Map of ${place} with the courses in order`}>
        {!data && <span className="trip-map-loading">Loading map…</span>}
      </div>
      {data && showLegs && (
        <ol className="trip-map-legs">
          {data.airport && <li><span className="pin pin-airport">{data.airport.code}</span><span className="grow">Arrive</span></li>}
          {legs.map((l, i) => (
            <li key={i}>
              <span className="pin">{l.label}</span>
              <span className="grow">{l.name}</span>
              <span className="row-meta">{l.from !== undefined ? (l.from <= 1 && i ? 'same place' : `~${l.from} mi`) : 'not on map'}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
