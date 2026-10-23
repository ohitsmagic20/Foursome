'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface Stop { name: string; label: string; search?: string }
interface MapData { center: { lat: number; lon: number }; airport: { code: string; lat: number; lon: number } | null; courses: { name: string; lat: number; lon: number }[] }

const R = 3958.8;
function miles(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** Straight-line distance stretched to a rough road distance. */
const roadMiles = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => Math.max(1, Math.round(miles(a, b) * 1.25));

/** A small map of the trip: the arrival airport and each course in playing order, joined by dashed lines. */
export function TripMap({ place, airport, stops }: { place: string; airport?: string; stops: Stop[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<MapData | null>(null);
  const [failed, setFailed] = useState(false);
  const names = [...new Set(stops.map((s) => (s.search ? `${s.name}::${s.search}` : s.name)))];
  const key = `${place}|${airport || ''}|${names.join('|')}`;

  useEffect(() => {
    if (!names.length) return;
    const q = new URLSearchParams({ place });
    if (airport) q.set('airport', airport);
    names.forEach((n) => q.append('course', n));
    let live = true;
    setData(null); setFailed(false);
    fetch(`/api/map?${q}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d: MapData) => live && setData(d)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stops in order, with coordinates where the course was found.
  const placed = data ? stops.map((s) => ({ ...s, at: data.courses.find((c) => c.name === s.name) || null })) : [];
  const path = [...(data?.airport ? [{ label: data.airport.code, at: data.airport }] : []), ...placed.filter((p) => p.at).map((p) => ({ label: p.label, at: p.at! }))];

  useEffect(() => {
    if (!data || !el.current || !path.length) return;
    let map: import('leaflet').Map | null = null;
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !el.current) return;
      map = L.map(el.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false, dragging: true, tap: false } as L.MapOptions);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 16, attribution: '© OpenStreetMap' }).addTo(map);
      const pts = path.map((p) => L.latLng(p.at.lat, p.at.lon));
      if (pts.length > 1) L.polyline(pts, { color: '#1e5a3b', weight: 2.5, dashArray: '6 6', opacity: 0.9 }).addTo(map);
      // Courses visited more than once get one pin with every number on it.
      const byPlace = new Map<string, { at: { lat: number; lon: number }; labels: string[]; airport: boolean }>();
      path.forEach((p, i) => {
        const k = `${p.at.lat.toFixed(4)},${p.at.lon.toFixed(4)}`;
        const isAirport = !!data.airport && i === 0;
        const e = byPlace.get(k) || { at: p.at, labels: [], airport: isAirport };
        e.labels.push(p.label);
        byPlace.set(k, e);
      });
      for (const e of byPlace.values()) {
        const html = `<span class="pin${e.airport ? ' pin-airport' : ''}">${e.labels.join(' ')}</span>`;
        L.marker([e.at.lat, e.at.lon], { icon: L.divIcon({ className: '', html, iconSize: undefined as unknown as L.PointExpression }), keyboard: false }).addTo(map);
      }
      map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 13 });
    });
    return () => { cancelled = true; map?.remove(); };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!names.length || failed) return null;
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
      {data && (
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
