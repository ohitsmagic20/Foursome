import 'server-only';
import type { Trip } from './shared';
import { rangeLabel } from './shared';
import { db } from './server';

/** What someone holding an invite link (not yet on the trip) gets to see: who's in by first name,
 *  and what's been settled or is up for a vote. No budgets, votes or anything else private. */
export interface TripPreview {
  organizer: string;
  count: number;
  names: string[];
  place: string | null;
  dates: string | null;
  placeOptions: number;
  dateOptions: number;
}

const first = (n: string) => String(n || '').trim().split(/\s+/)[0];

export async function tripPreview(trip: Trip): Promise<TripPreview> {
  const [{ data: mem }, { data: opts }] = await Promise.all([
    db().from('members').select('name,is_organizer,created_at').eq('trip_id', trip.id).order('created_at'),
    db().from('options').select('kind,locked,data').eq('trip_id', trip.id).in('kind', ['date', 'destination']),
  ]);
  const members = mem || [];
  const org = members.find((m) => m.is_organizer);
  const lockedDest = (opts || []).find((o) => o.kind === 'destination' && o.locked);
  const lockedDate = (opts || []).find((o) => o.kind === 'date' && o.locked);
  const d = lockedDate?.data as { start?: string; nights?: number } | undefined;
  return {
    organizer: org ? first(org.name) : '',
    count: members.length,
    names: members.map((m) => first(m.name)).filter(Boolean).slice(0, 8),
    place: lockedDest ? String((lockedDest.data as { name?: string }).name || '') || null : null,
    dates: d?.start ? rangeLabel(d.start, d.nights || trip.nights) : null,
    placeOptions: (opts || []).filter((o) => o.kind === 'destination').length,
    dateOptions: (opts || []).filter((o) => o.kind === 'date').length,
  };
}
