'use client';

// The trip map as a picture, for the one-pager: OpenStreetMap tiles on a canvas, the routes by road
// (each day from the stay, course to course on a 36-hole day, and the airport to the stay), and the pins.
import type { DestinationData, LodgingData, Option, RoundData, TripState } from '@/lib/shared';
import { destAirports, pickOf, plannedRounds, tally, teeMinutes } from '@/lib/shared';
import { templateBySlug } from '@/data/templates';
import { mapUrl, type MapData, type Stop } from './TripMap';

type Pt = { lat: number; lon: number };
const TILE = 256;
const lon2x = (lon: number, z: number) => ((lon + 180) / 360) * TILE * 2 ** z;
const lat2y = (lat: number, z: number) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * TILE * 2 ** z; };

const loadImg = (src: string) => new Promise<HTMLImageElement | null>((res) => {
  const im = new Image(); im.crossOrigin = 'anonymous'; im.referrerPolicy = 'no-referrer';
  const t = setTimeout(() => res(null), 6000);
  im.onload = () => { clearTimeout(t); res(im); }; im.onerror = () => { clearTimeout(t); res(null); };
  im.src = src;
});

/** The rounds the map shows, in playing order: the plan, else the best-liked round each day. */
function mapRounds(state: TripState, place: string | null) {
  const inHere = (r: Option<RoundData>) => { const d = (r.data as { dest?: string }).dest; return !d || !place || d === place; };
  let rs = plannedRounds(state).filter(inHere);
  if (!rs.length) {
    const best = new Map<number, Option<RoundData>>();
    for (const r of (state.options.filter((o) => o.kind === 'round') as Option<RoundData>[]).filter(inHere).sort((a, b) => tally(state, b.id).score - tally(state, a.id).score)) if (!best.has(r.data.day)) best.set(r.data.day, r);
    rs = [...best.values()];
  }
  return rs.sort((a, b) => a.data.day - b.data.day || teeMinutes(a.data.time) - teeMinutes(b.data.time));
}

/**
 * Draw the trip map. Returns a PNG data URL and its pixel size, or null when there's nothing to show
 * (no destination, or no stay and no courses found).
 */
/** `k` scales pins, labels and lines (for a map shown smaller on the page). */
export async function tripMapImage(state: TripState, w = 1088, h = 360, k = 1): Promise<{ src: string; w: number; h: number } | null> {
  const dest = pickOf<DestinationData>(state, 'destination').option;
  if (!dest) return null;
  const stay = pickOf<LodgingData>(state, 'lodging').option;
  const rounds = mapRounds(state, dest.id);
  const stops: Stop[] = rounds.map((r, i) => ({
    name: r.data.course, label: String(i + 1), courseId: r.data.courseId, day: r.data.day,
    search: r.data.fromTemplate ? templateBySlug(r.data.fromTemplate)?.rounds.find((x) => x.course === r.data.course)?.mapAs : undefined,
  }));
  let data: MapData | null = null;
  try { const res = await fetch(mapUrl(dest.data.name, destAirports(dest.data)[0], stops)); if (res.ok) data = await res.json(); } catch { /* drawn without courses */ }
  const home: Pt | null = stay?.data.lat && stay.data.lon ? { lat: stay.data.lat, lon: stay.data.lon } : null;
  const courses = data ? stops.map((s) => ({ s, at: data!.courses.find((c) => c.name === s.name) })).filter((x) => x.at) as { s: Stop; at: Pt }[] : [];
  const airport = data?.airport || null;
  const pts: Pt[] = [...courses.map((c) => c.at), ...(home ? [home] : []), ...(airport ? [airport] : [])];
  if (!courses.length && !home) return null;

  // Legs, the same as the Golf tab: each day from the stay, then course to course that day; plus airport → stay.
  const legs: { a: Pt; b: Pt; airport: boolean }[] = [];
  let prev: Pt | null = null, prevDay: number | undefined;
  courses.forEach((c, i) => {
    if (i === 0 || c.s.day !== prevDay) prev = home;
    if (prev && (Math.abs(prev.lat - c.at.lat) > 1e-4 || Math.abs(prev.lon - c.at.lon) > 1e-4)) legs.push({ a: prev, b: c.at, airport: false });
    prev = c.at; prevDay = c.s.day;
  });
  if (home && airport) legs.push({ a: airport, b: home, airport: true });
  let roads: ([number, number][] | null)[] = [];
  if (legs.length) {
    try {
      const q = legs.map((l) => `${l.a.lat.toFixed(5)},${l.a.lon.toFixed(5)};${l.b.lat.toFixed(5)},${l.b.lon.toFixed(5)}`).join('|');
      const res = await fetch(`/api/route?legs=${encodeURIComponent(q)}`);
      if (res.ok) roads = ((await res.json()) as { legs: ([number, number][] | null)[] }).legs;
    } catch { /* straight lines */ }
  }
  // Fit everything, including the road paths, with room around the edges for the pins.
  const all: Pt[] = [...pts, ...roads.flatMap((r) => (r || []).map(([lat, lon]) => ({ lat, lon })))];
  // Any zoom, not just whole steps: the tiles are scaled, so the trip fills the frame.
  const pad = 44 * k;
  const span = (zz: number) => {
    const xs = all.map((p) => lon2x(p.lon, zz)), ys = all.map((p) => lat2y(p.lat, zz));
    return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  };
  const s0 = span(0);
  const fitX = (w - pad * 2) / Math.max(1e-9, s0.x1 - s0.x0), fitY = (h - pad * 2) / Math.max(1e-9, s0.y1 - s0.y0);
  const z = all.length === 1 ? 12 : Math.max(3, Math.min(14, Math.log2(Math.min(fitX, fitY))));
  const sp = span(z);
  const ox = (sp.x0 + sp.x1) / 2 - w / 2, oy = (sp.y0 + sp.y1) / 2 - h / 2;
  const X = (p: Pt) => lon2x(p.lon, z) - ox, Y = (p: Pt) => lat2y(p.lat, z) - oy;

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#e8ece4'; g.fillRect(0, 0, w, h);
  // Tiles (OpenStreetMap). If they can't load, the map still has its routes and pins.
  const zt = Math.ceil(z - 0.15); // tiles one step sharper, drawn a little smaller
  const tileScale = 2 ** (z - zt), size = TILE * tileScale;
  const tx0 = Math.floor(ox / size), ty0 = Math.floor(oy / size), tx1 = Math.floor((ox + w) / size), ty1 = Math.floor((oy + h) / size);
  const n = 2 ** zt;
  const jobs: Promise<void>[] = [];
  for (let tx = tx0; tx <= tx1; tx++) for (let ty = ty0; ty <= ty1; ty++) {
    if (ty < 0 || ty >= n) continue;
    const x = ((tx % n) + n) % n;
    jobs.push(loadImg(`https://tile.openstreetmap.org/${zt}/${x}/${ty}.png`).then((im) => { if (im) g.drawImage(im, tx * size - ox, ty * size - oy, size + 0.5, size + 0.5); }));
  }
  await Promise.all(jobs);
  // Soften the base map so the routes and pins stand out.
  g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, 0, w, h);

  // Routes: a white casing under the line; the airport one lighter and dashed.
  legs.forEach((l, i) => {
    const path = roads[i] && roads[i]!.length > 1 ? roads[i]!.map(([lat, lon]) => ({ lat, lon })) : [l.a, l.b];
    const trace = () => { g.beginPath(); path.forEach((p, k) => (k ? g.lineTo(X(p), Y(p)) : g.moveTo(X(p), Y(p)))); };
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.setLineDash([]); g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = (l.airport ? 7 : 9) * k; trace(); g.stroke();
    g.setLineDash(l.airport ? [7 * k, 8 * k] : roads[i] ? [] : [10 * k, 9 * k]);
    g.strokeStyle = l.airport ? '#5b6a61' : '#1e5a3b'; g.lineWidth = (l.airport ? 3.5 : 5) * k; trace(); g.stroke();
  });
  g.setLineDash([]);

  // Pins, nudged apart where they'd overlap. Courses at the same spot share a pin ("2 4").
  type Pin = { x: number; y: number; kind: 'course' | 'home' | 'airport'; text: string };
  const pins: Pin[] = [];
  if (home) pins.push({ x: X(home), y: Y(home), kind: 'home', text: '' });
  if (airport) pins.push({ x: X(airport), y: Y(airport), kind: 'airport', text: (airport as { code?: string }).code || '✈' });
  for (const c of courses) {
    const same = pins.find((p) => p.kind === 'course' && Math.hypot(p.x - X(c.at), p.y - Y(c.at)) < 6);
    if (same) { if (!same.text.split(' ').includes(c.s.label)) same.text += ` ${c.s.label}`; } else pins.push({ x: X(c.at), y: Y(c.at), kind: 'course', text: c.s.label });
  }
  const placed: { x: number; y: number }[] = [];
  const steps = [[0, 0], [40, 0], [-40, 0], [0, 36], [0, -36], [40, 36], [-40, 36], [40, -36], [-40, -36]].map(([a, b]) => [a * k, b * k]);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const p of pins) {
    const [dx, dy] = steps.find(([sx, sy]) => !placed.some((q) => Math.abs(q.x - (p.x + sx)) < 42 * k && Math.abs(q.y - (p.y + sy)) < 34 * k)) || [0, 0];
    const x = p.x + dx, y = p.y + dy;
    placed.push({ x, y });
    g.font = `700 ${22 * k}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    const tw = p.kind === 'home' ? 30 * k : Math.max(30 * k, g.measureText(p.text).width + 18 * k);
    const bw = p.kind === 'course' && p.text.length <= 2 ? 34 * k : tw + (p.kind === 'home' ? 0 : 4 * k), bh = 34 * k;
    g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = 6; g.shadowOffsetY = 2;
    g.fillStyle = p.kind === 'home' ? '#b0412c' : p.kind === 'airport' ? '#16241c' : '#1e5a3b';
    g.beginPath(); g.roundRect(x - bw / 2, y - bh / 2, bw, bh, p.kind === 'course' && p.text.length <= 2 ? bh / 2 : 9 * k); g.fill();
    g.shadowColor = 'transparent';
    g.lineWidth = 3 * k; g.strokeStyle = '#ffffff'; g.stroke();
    g.fillStyle = '#ffffff';
    if (p.kind === 'home') {
      // A little house.
      g.lineWidth = 3 * k; g.strokeStyle = '#fff'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(x - 9 * k, y + k); g.lineTo(x, y - 8 * k); g.lineTo(x + 9 * k, y + k); g.stroke();
      g.beginPath(); g.moveTo(x - 6 * k, y - k); g.lineTo(x - 6 * k, y + 8 * k); g.lineTo(x + 6 * k, y + 8 * k); g.lineTo(x + 6 * k, y - k); g.stroke();
    } else g.fillText(p.text, x, y + 1);
  }
  // Attribution, as OpenStreetMap asks.
  g.font = `500 ${15 * k}px "Instrument Sans", Arial, sans-serif`; g.textAlign = 'right'; g.textBaseline = 'bottom';
  const att = '© OpenStreetMap contributors';
  const aw = g.measureText(att).width + 12;
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(w - aw, h - 22 * k, aw, 22 * k);
  g.fillStyle = '#16241c'; g.fillText(att, w - 6, h - 4);
  try { return { src: canvas.toDataURL('image/png'), w, h }; } catch { return null; } // a tainted canvas (tiles without CORS)
}
