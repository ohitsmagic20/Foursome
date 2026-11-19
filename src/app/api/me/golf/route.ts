import { profileFromRequest } from '@/lib/auth';
import { golfHistory } from '@/lib/history';
import { handle } from '@/lib/server';
import { golfTotals } from '@/lib/shared';

export const dynamic = 'force-dynamic';

// The signed-in person's golf on every trip: match records, holes and side games.
export function GET(req: Request) {
  return handle(async () => {
    const profile = await profileFromRequest(req, true);
    const trips = (await golfHistory([profile.id])).get(profile.id) || [];
    return Response.json({ trips, totals: golfTotals(trips) });
  });
}
