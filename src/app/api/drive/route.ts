// Drive times between places: each stay to each course (and the airport), from OpenStreetMap routing (OSRM).
// GET /api/drive?from=lat,lon|lat,lon&to=lat,lon|lat,lon → { minutes: number[][] | null, miles: number[][] | null }
// minutes[i][j] is from `from[i]` to `to[j]`. Null when the routing service can't be reached; the app then estimates.

const parse = (s: string | null, max: number) =>
  (s || '').split('|').slice(0, max).map((p) => p.split(',').map(Number)).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && (a || b));

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const from = parse(q.get('from'), 12), to = parse(q.get('to'), 16);
  if (!from.length || !to.length) return Response.json({ minutes: null, miles: null });
  // OSRM wants lon,lat, all points in one list, then which are sources and which destinations.
  const pts = [...from, ...to].map(([lat, lon]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(';');
  const sources = from.map((_, i) => i).join(';');
  const dests = to.map((_, j) => from.length + j).join(';');
  try {
    const res = await fetch(`https://router.project-osrm.org/table/v1/driving/${pts}?sources=${sources}&destinations=${dests}&annotations=duration,distance`, {
      headers: { 'User-Agent': 'Foresome golf trip planner (https://www.foresomes.net)' },
      // Roads don't move: keep answers for a month.
      next: { revalidate: 60 * 60 * 24 * 30 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const j = (await res.json()) as { code: string; durations?: (number | null)[][]; distances?: (number | null)[][] };
    if (j.code !== 'Ok' || !j.durations) throw new Error(j.code);
    const minutes = j.durations.map((row) => row.map((s) => (s === null ? -1 : Math.max(1, Math.round(s / 60)))));
    const miles = (j.distances || []).map((row) => row.map((m) => (m === null ? -1 : Math.max(1, Math.round(m / 1609.34)))));
    return Response.json({ minutes, miles }, { headers: { 'Cache-Control': 'public, s-maxage=2592000, stale-while-revalidate=86400' } });
  } catch {
    return Response.json({ minutes: null, miles: null });
  }
}
