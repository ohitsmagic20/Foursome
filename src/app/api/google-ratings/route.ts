import { geocode } from '@/lib/geo';
import { handle, HttpError, int, ipKey, rateLimit, str } from '@/lib/server';

// Google Maps star ratings for golf courses around a destination (one Places "Nearby Search" per request).
// Off until GOOGLE_MAPS_API_KEY is set. Google's terms don't allow storing the ratings, so nothing is cached
// on the server; a daily cap (GOOGLE_PLACES_DAILY_LIMIT, default 30) keeps usage inside Google's free monthly amount.
// GET /api/google-ratings?place=Kohler, WI&miles=30

export interface GooglePlace { name: string; rating: number; count: number; url: string; lat: number; lon: number }

export function GET(req: Request) {
  return handle(async () => {
    const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
    const noStore = { headers: { 'Cache-Control': 'private, no-store' } };
    if (!key) return Response.json({ enabled: false, places: [] }, noStore);

    const q = new URL(req.url).searchParams;
    const placeQ = str(q.get('place'), 80);
    if (!placeQ) throw new HttpError(400, 'Missing place.');
    const radius = Math.min(int(q.get('miles'), 5, 50, 30) * 1609, 50000); // Google's maximum is 50 km

    await rateLimit(`google:${ipKey(req)}`, 20, 60, 'Too many rating lookups. Try again later.');
    const daily = int(process.env.GOOGLE_PLACES_DAILY_LIMIT, 0, 100000, 30);
    try { await rateLimit('google-places-day', daily, 24 * 60, 'cap'); }
    catch { return Response.json({ enabled: true, limited: true, places: [] }, noStore); }

    const at = await geocode(placeQ);
    if (!at) throw new HttpError(404, 'Couldn’t find that place.');
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.location',
      },
      body: JSON.stringify({
        includedTypes: ['golf_course'],
        maxResultCount: 20,
        rankPreference: 'POPULARITY',
        locationRestriction: { circle: { center: { latitude: at.lat, longitude: at.lon }, radius } },
      }),
    });
    if (!res.ok) {
      console.error('google places', res.status, (await res.text()).slice(0, 300));
      return Response.json({ enabled: true, failed: true, places: [] }, noStore);
    }
    const j = (await res.json()) as { places?: { displayName?: { text?: string }; rating?: number; userRatingCount?: number; googleMapsUri?: string; location?: { latitude: number; longitude: number } }[] };
    const places: GooglePlace[] = (j.places || [])
      .filter((p) => p.rating && p.location)
      .map((p) => ({ name: p.displayName?.text || '', rating: p.rating!, count: p.userRatingCount || 0, url: p.googleMapsUri || '', lat: p.location!.latitude, lon: p.location!.longitude }));
    return Response.json({ enabled: true, places }, noStore);
  });
}
