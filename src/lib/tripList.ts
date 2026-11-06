// Sorting and labelling a person's trips for the trip switcher and the home screen. Pure, so it can be tested.
import type { MyTrip } from './shared';
import type { SavedTrip } from './client';

export interface TripItem {
  code: string; name: string;
  start: string | null; nights: number; destination: string | null; members: number;
  organizer: boolean; tentative: boolean; seen: number;
}

/** Trips from the account and trips remembered on this phone, as one list. The account's locked picks win;
 *  the phone fills in leading (not yet locked) dates and places it saw. */
export function mergeTrips(account: MyTrip[] | null, local: SavedTrip[]): TripItem[] {
  const byCode = new Map<string, TripItem>();
  for (const t of local) {
    byCode.set(t.code, {
      code: t.code, name: t.name, start: t.start || null, nights: t.nights || 0, destination: t.destination || null,
      members: t.members || 0, organizer: false, tentative: !!t.tentative, seen: t.seen || 0,
    });
  }
  for (const t of account || []) {
    const l = byCode.get(t.code);
    byCode.set(t.code, {
      code: t.code, name: t.name,
      start: t.start || l?.start || null,
      nights: t.start ? t.nights : l?.nights || t.nights,
      destination: t.destination || l?.destination || null,
      members: t.members || l?.members || 0, organizer: t.organizer,
      tentative: !t.start && !!l?.start ? true : !t.destination && !!l?.destination ? true : false,
      seen: l?.seen || 0,
    });
  }
  return Array.from(byCode.values());
}

const DAY = 86400000;
const dayOf = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };
const midnight = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

/** Upcoming trips soonest first; trips without dates by when you last opened them; past trips most recent first. */
export function groupTrips(list: TripItem[], now = new Date()) {
  const today = midnight(now);
  const upcoming: TripItem[] = [], undated: TripItem[] = [], past: TripItem[] = [];
  for (const t of list) {
    if (!t.start) undated.push(t);
    else if (dayOf(t.start) + Math.max(t.nights, 0) * DAY < today) past.push(t);
    else upcoming.push(t);
  }
  upcoming.sort((a, b) => a.start!.localeCompare(b.start!));
  undated.sort((a, b) => b.seen - a.seen);
  past.sort((a, b) => b.start!.localeCompare(a.start!));
  return { upcoming, undated, past };
}

/** "In 3 days", "In 9 weeks", "In 4 months", "Happening now". */
export function countdown(t: TripItem, now = new Date()): string {
  if (!t.start) return '';
  const today = midnight(now), a = dayOf(t.start), b = a + t.nights * DAY;
  if (today >= a && today <= b) return 'Happening now';
  const days = Math.round((a - today) / DAY);
  if (days < 0) return '';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 14) return `In ${days} days`;
  if (days < 63) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30.4)} months`;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** The tile on the left of each trip: month and day, or a dash when the dates aren't set. */
export function dateTile(t: TripItem): { top: string; big: string } {
  if (!t.start) return { top: 'Dates', big: '–' };
  const [, m, d] = t.start.split('-').map(Number);
  return { top: MON[m - 1], big: String(d) };
}
