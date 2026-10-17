import { geocode, nearbyAirports } from '@/lib/geo';
import { handle, HttpError, str } from '@/lib/server';

// Closest airports with scheduled flights to a destination. The best one or two come back marked `suggested`.
export function GET(req: Request) {
  return handle(async () => {
    const placeQ = str(new URL(req.url).searchParams.get('place'), 80);
    if (placeQ.length < 2) throw new HttpError(400, 'Type a destination.');
    const place = await geocode(placeQ);
    if (!place) throw new HttpError(404, `Couldn't find “${placeQ}” on the map. Try “City, ST”.`);
    return Response.json(
      { place: `${place.name}${place.region ? `, ${place.region}` : ''}`, airports: nearbyAirports(place.lat, place.lon) },
      { headers: { 'Cache-Control': 'public, max-age=86400' } },
    );
  });
}
