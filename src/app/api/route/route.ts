// Road paths for the map's lines, from OpenStreetMap routing (OSRM).
// GET /api/route?legs=lat,lon;lat,lon|lat,lon;lat,lon → { legs: ([lat, lon][] | null)[] }
// One path per leg, in order; null for a leg the routing service couldn't answer (the map keeps a straight line).

const pt = (s: string) => { const [a, b] = s.split(',').map(Number); return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? [a, b] as [number, number] : null; };

/** Keep every few points: a phone-sized map doesn't need thousands. */
function thin(coords: [number, number][], max = 180): [number, number][] {
  if (coords.length <= max) return coords;
  const step = coords.length / max;
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[Math.floor(i)]);
  out.push(coords[coords.length - 1]);
  return out;
}

async function leg(a: [number, number], b: [number, number]): Promise<[number, number][] | null> {
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${a[1].toFixed(5)},${a[0].toFixed(5)};${b[1].toFixed(5)},${b[0].toFixed(5)}?overview=full&geometries=geojson`, {
      headers: { 'User-Agent': 'Foresome golf trip planner (https://www.foresomes.net)' },
      next: { revalidate: 60 * 60 * 24 * 30 }, // roads don't move: keep for a month
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { code: string; routes?: { geometry: { coordinates: [number, number][] } }[] };
    const c = j.code === 'Ok' ? j.routes?.[0]?.geometry.coordinates : null;
    return c && c.length > 1 ? thin(c.map(([lon, lat]) => [Math.round(lat * 1e5) / 1e5, Math.round(lon * 1e5) / 1e5])) : null;
  } catch { return null; }
}

export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get('legs') || '').split('|').slice(0, 14);
  const pairs = raw.map((l) => l.split(';').map(pt)).map(([a, b]) => (a && b ? [a, b] as const : null));
  // A few at a time, to be polite to the free routing server.
  const legs: ([number, number][] | null)[] = [];
  for (let i = 0; i < pairs.length; i += 4) {
    legs.push(...(await Promise.all(pairs.slice(i, i + 4).map((p) => (p ? leg(p[0], p[1]) : Promise.resolve(null))))));
  }
  return Response.json({ legs }, { headers: { 'Cache-Control': 'public, s-maxage=2592000, stale-while-revalidate=86400' } });
}
