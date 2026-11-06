import { airportCoords } from '@/lib/geo';
import { handle, HttpError } from '@/lib/server';
import { nearby } from '@/lib/resorts';

// Stay-and-play packages and golf resorts near a trip's arrival airports. Public data, cached a day.
export function GET(req: Request) {
  return handle(async () => {
    const codes = (new URL(req.url).searchParams.get('airports') || '').toUpperCase().split(',').map((s) => s.trim()).filter((s) => /^[A-Z]{3}$/.test(s)).slice(0, 4);
    const at = codes.map(airportCoords).find(Boolean);
    if (!at) throw new HttpError(400, 'Unknown airport.');
    return Response.json(nearby(at.lat, at.lon), { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
  });
}
