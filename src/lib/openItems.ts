import type { DateData, LodgingData, Member, Option, RoundData, TripState } from './shared';
import { dayLabel, firstTee, landsTooLate, pickOf, plannedRounds, teeTimesNeeded } from './shared';

/** `text` is for the organizer; `mine` is the same thing said to the person whose job it is. */
export interface OpenItem { text: string; who: string[]; tab: 'stay' | 'golf' | 'flights'; mine?: string }

const first = (n: string) => n.trim().split(/\s+/)[0];

/** Everything still open on a trip, each tagged with whose job it is (empty = the organizer's). */
export function openItems(state: TripState): OpenItem[] {
  const items: OpenItem[] = [];
  const name = (id?: string) => first(state.members.find((m) => m.id === id)?.name || '');
  const start = pickOf<DateData>(state, 'date').option?.data.start;
  const label = (r: Option<RoundData>) => `${r.data.course} (${start ? dayLabel(start, r.data.day) : `day ${r.data.day}`}, ${r.data.time})`;

  const stay = pickOf<LodgingData>(state, 'lodging');
  if (!stay.locked) items.push({ text: 'Nowhere to stay is locked in yet.', who: [], tab: 'stay' });
  else if (!stay.option!.data.booked) {
    const o = stay.option!.data.owner;
    items.push({ text: `${stay.option!.data.name} isn’t marked booked${o ? ` (${name(o)} is booking it)` : ''}.`, who: o ? [o] : [], tab: 'stay', mine: `You’re booking ${stay.option!.data.name}. Mark it booked once it’s done.` });
  }

  const rounds = plannedRounds(state);
  if (!rounds.length) items.push({ text: 'No golf is in the plan yet.', who: [], tab: 'golf' });
  for (const r of rounds) {
    if (!r.data.booked) items.push({ text: `${label(r)} isn’t marked booked${r.data.owner ? ` (${name(r.data.owner)} is booking it)` : ''}.`, who: r.data.owner ? [r.data.owner] : [], tab: 'golf', mine: `You’re booking ${label(r)}. Mark it booked once it’s done.` });
    if (teeTimesNeeded(state.members.length) > 1 && !(r.data.groups || []).length) items.push({ text: `Pairings aren’t set for ${label(r)}.`, who: [], tab: 'golf' });
  }

  const noFlight = state.members.filter((m) => m.flight_price === null);
  if (noFlight.length) {
    const n = noFlight.map((m) => first(m.name));
    const list = n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`;
    items.push({ text: `${list} ${n.length === 1 ? 'hasn’t' : 'haven’t'} added a flight.`, who: noFlight.map((m) => m.id), tab: 'flights', mine: 'Add your flight so everyone knows when you land.' });
  }
  const tee = firstTee(state);
  for (const m of state.members.filter((x) => landsTooLate(state, x.flight_arrive_at))) {
    items.push({ text: `${first(m.name)}’s flight lands too late for the ${tee?.time} tee time.`, who: [m.id], tab: 'flights', mine: `Your flight lands too late for the ${tee?.time} tee time on arrival day.` });
  }
  for (const m of state.members.filter((x) => x.flight_price !== null && x.flight_summary !== 'Driving' && x.flight_booked === false)) {
    items.push({ text: `${first(m.name)} picked a flight but hasn’t marked it booked.`, who: [m.id], tab: 'flights', mine: 'You picked a flight but haven’t marked it booked.' });
  }
  return items;
}

/** What one person should see: their own items, said to them. */
export function forMember(items: OpenItem[], m: Member): string[] {
  return items.filter((i) => i.who.includes(m.id)).map((i) => i.mine || i.text);
}

