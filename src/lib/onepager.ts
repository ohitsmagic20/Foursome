// What goes on the trip one-pager: a snapshot of the plan, decided or not, plus what's still open.
import type { DateData, DestinationData, LodgingData, Option, RoundData, TripState } from './shared';
import {
  andList, costOf, dayLabel, duelRecord, money, nightsOf, optionsOf, parseDay, pickOf, placePlan,
  plannedRounds, priceTier, pts, rangeLabel, tally, teeMinutes, teeTimesNeeded, cupScore,
} from './shared';

export type Status = 'done' | 'voting' | 'todo';
export interface Fact { label: string; value: string; note: string; status: Status }
export interface PlanDay { label: string; rounds: { time: string; course: string; fee: string; tier: string; booked: boolean; suggested: boolean }[] }
export interface OnePager {
  title: string;
  subtitle: string;
  countdown: string | null;
  asOf: string;
  facts: Fact[];
  checklist: { title: string; note: string; status: Status }[];
  places: { name: string; yes: number; each: string; leading: boolean }[] | null;
  days: PlanDay[];
  daysNote: string;
  stay: { name: string; detail: string; each: string; status: Status } | null;
  cost: { label: string; value: string }[];
  costNote: string;
  crew: { name: string; full: string; from: string; flight: boolean; organizer: boolean }[];
  cup: { title: string; line: string } | null;
  highlights: string[];
  todo: string[];
}

const first = (n: string) => n.trim().split(/\s+/)[0] || n;
const short = (place: string) => place.split(',')[0];

export function buildOnePager(state: TripState, now = new Date()): OnePager {
  const n = state.members.length;
  const date = pickOf<DateData>(state, 'date');
  const dest = pickOf<DestinationData>(state, 'destination');
  const stay = pickOf<LodgingData>(state, 'lodging');
  const dests = optionsOf<DestinationData>(state, 'destination');
  const dates = optionsOf<DateData>(state, 'date');
  const nights = date.option ? nightsOf(state.trip, date.option.data) : state.trip.nights;
  const range = date.option ? rangeLabel(date.option.data.start, nights) : '';

  // Countdown once the dates are set.
  let countdown: string | null = null;
  if (date.locked && date.option) {
    const t = new Date(now); t.setHours(0, 0, 0, 0);
    const d = Math.round((parseDay(date.option.data.start).getTime() - t.getTime()) / 864e5);
    countdown = d > 1 ? `${d} days out` : d === 1 ? 'Tomorrow' : d === 0 ? 'Today' : d >= -nights ? 'Happening now' : null;
  }

  const placeName = dest.option ? dest.option.data.name : '';
  const subtitle = [
    placeName ? `${placeName}${dest.locked ? '' : '?'}` : 'Place TBD',
    range ? `${range}${date.locked ? '' : '?'}` : 'Dates TBD',
    `${n} golfer${n === 1 ? '' : 's'}`,
  ].join('  ·  ');

  // Rounds: the plan if there is one, else the best-liked suggestion each day.
  const planned = plannedRounds(state);
  const placeRounds = (dest.option ? optionsOf<RoundData>(state, 'round').filter((r) => { const p = (r.data as { dest?: string }).dest; return !p || p === dest.option!.id; }) : optionsOf<RoundData>(state, 'round'));
  let rounds: Option<RoundData>[] = planned;
  let suggested = false;
  if (!rounds.length && placeRounds.length) {
    const best = new Map<number, Option<RoundData>>();
    for (const r of placeRounds.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score)) if (!best.has(r.data.day)) best.set(r.data.day, r);
    rounds = [...best.values()];
    suggested = true;
  }
  rounds = rounds.slice().sort((a, b) => a.data.day - b.data.day || teeMinutes(a.data.time) - teeMinutes(b.data.time));
  const byDay = new Map<number, Option<RoundData>[]>();
  for (const r of rounds) byDay.set(r.data.day, [...(byDay.get(r.data.day) || []), r]);
  // Room for about 8 rounds on the page; a longer trip shows the first ones and says how many more.
  let room = !dest.locked && dests.length > 1 ? 6 : 8;
  const days: PlanDay[] = [...byDay.entries()].filter(([, all]) => all.length > 0).map(([d, all]) => { const rs = all.slice(0, Math.min(3, room)); room -= rs.length; return [d, rs] as const; }).map(([d, rs]) => ({
    label: date.option ? dayLabel(date.option.data.start, d) : `Day ${d}`,
    rounds: rs.map((r) => ({
      time: r.data.time || '',
      course: r.data.course,
      fee: Number(r.data.fee) ? `${r.data.estimate ? '~' : ''}${money(Number(r.data.fee))}` : 'Price TBD',
      tier: priceTier(Number(r.data.fee)) || '',
      booked: !!r.data.booked,
      suggested: suggested || !r.locked,
    })),
  }));
  for (let i = days.length - 1; i >= 0; i--) if (!days[i].rounds.length) days.splice(i, 1);
  const hidden = rounds.length - days.reduce((t, d) => t + d.rounds.length, 0);
  const daysNote = (hidden > 0 ? `Showing ${rounds.length - hidden} of ${rounds.length} rounds · ` : '') + (!rounds.length ? 'No rounds suggested yet.' : suggested ? 'Not set yet: the best-liked round each day so far.' : `${rounds.filter((r) => r.data.booked).length} of ${rounds.length} rounds booked · ${teeTimesNeeded(n)} tee time${teeTimesNeeded(n) === 1 ? '' : 's'} each`);

  // Stay.
  const stayInfo = stay.option ? {
    name: stay.option.data.name,
    detail: [stay.option.data.bedrooms ? `${stay.option.data.bedrooms} bedroom${stay.option.data.bedrooms === 1 ? '' : 's'}` : '', stay.option.data.beds ? `${stay.option.data.beds} beds` : '', stay.option.data.where || '', Number(stay.option.data.total) ? `${money(Number(stay.option.data.total))} total` : ''].filter(Boolean).join(' · '),
    each: Number(stay.option.data.total) && n ? `~${money(Number(stay.option.data.total) / n)} each` : '',
    status: (stay.locked ? 'done' : 'voting') as Status,
  } : null;

  // Money: the average person's share so far.
  const costs = state.members.map((m) => costOf(state, m));
  const avg = (k: 'stay' | 'golf' | 'food' | 'total') => (n ? costs.reduce((s, c) => s + c[k], 0) / n : 0);
  const flights = state.members.filter((m) => m.flight_price !== null).map((m) => Number(m.flight_price) || 0);
  const avgFlight = flights.length ? flights.reduce((a, b) => a + b, 0) / flights.length : 0;
  const lo = costs.length ? Math.min(...costs.map((c) => c.total)) : 0, hi = costs.length ? Math.max(...costs.map((c) => c.total)) : 0;
  const cost = [
    { label: 'Stay', value: avg('stay') ? money(avg('stay')) : '—' },
    { label: 'Golf', value: avg('golf') ? money(avg('golf')) : '—' },
    { label: 'Food & drinks', value: avg('food') ? money(avg('food')) : '—' },
    { label: 'Flight', value: avgFlight ? money(avgFlight) : '—' },
  ];
  const costNote = flights.length < n ? `Flights: ${flights.length} of ${n} picked so far.` : '';
  const total = avg('stay') + avg('golf') + avg('food') + avgFlight;

  const facts: Fact[] = [
    { label: 'Where', value: placeName ? short(placeName) : 'TBD', note: dest.locked ? 'Locked in' : dests.length > 1 ? `Leading of ${dests.length}` : dest.option ? 'Suggested' : 'No ideas yet', status: dest.locked ? 'done' : dest.option ? 'voting' : 'todo' },
    { label: 'When', value: range || 'TBD', note: date.locked ? `${nights} night${nights === 1 ? '' : 's'}` : dates.length > 1 ? `Leading of ${dates.length}` : date.option ? 'Suggested' : 'No dates yet', status: date.locked ? 'done' : date.option ? 'voting' : 'todo' },
    { label: 'Crew', value: `${n}`, note: n < 4 ? `${n === 1 ? 'Solo' : n === 2 ? 'One on one' : 'A threesome'}, 1 tee time` : `${teeTimesNeeded(n)} foursome${teeTimesNeeded(n) === 1 ? '' : 's'}`, status: 'done' },
    { label: 'Per person', value: total ? money(total) : 'TBD', note: total ? (hi - lo > 50 && flights.length === n ? `${money(lo)}–${money(hi)}` : 'avg. so far') : 'Once things are picked', status: total ? 'voting' : 'todo' },
  ];

  const booked = planned.filter((r) => r.data.booked).length;
  const flown = state.members.filter((m) => m.flight_price !== null).length;
  const checklist = [
    { title: 'Dates', note: date.option ? `${range} ${date.locked ? 'locked' : 'leading'}` : 'Nobody has suggested dates', status: (date.locked ? 'done' : date.option ? 'voting' : 'todo') as Status },
    { title: 'Destination', note: dest.option ? `${short(placeName)} ${dest.locked ? 'locked' : 'leading'}` : 'Nobody has suggested a place', status: (dest.locked ? 'done' : dest.option ? 'voting' : 'todo') as Status },
    { title: 'Stay', note: stay.option ? `${stay.option.data.name} ${stay.locked ? 'locked' : 'leading'}` : 'No houses or hotels yet', status: (stay.locked ? 'done' : stay.option ? 'voting' : 'todo') as Status },
    { title: 'Tee times', note: planned.length ? `${booked} of ${planned.length} booked` : 'No rounds in the plan', status: (planned.length && booked === planned.length ? 'done' : planned.length ? 'voting' : 'todo') as Status },
    { title: 'Flights', note: `${flown} of ${n} picked`, status: (flown === n ? 'done' : flown ? 'voting' : 'todo') as Status },
  ];

  // Places still being compared: each one's whole trip.
  const places = !dest.locked && dests.length > 1
    ? dests.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score).slice(0, 4).map((d, i) => {
      const p = placePlan(state, d.id);
      return { name: d.data.name, yes: tally(state, d.id).yes, each: p.stay && p.golfRounds.length ? `${money(p.each)} stay + golf` : p.stay ? `${money(p.stayEach)} stay` : p.golfRounds.length ? `${money(p.golfEach)} golf` : 'Not planned yet', leading: i === 0 };
    })
    : null;

  // The cup or match play.
  let cup: OnePager['cup'] = null;
  const c = state.trip.cup;
  if (c) {
    const nm = (id: string) => first(state.members.find((m) => m.id === id)?.name || '');
    if (c.duel) {
      const r = duelRecord(c);
      cup = { title: `Match play · ${c.name}`, line: c.matches.length ? `${nm(c.teams[0].captain)} ${r.w}–${r.l}${r.h ? `–${r.h}` : ''} ${nm(c.teams[1].captain)}` : `${nm(c.teams[0].captain)} vs ${nm(c.teams[1].captain)} · matches not set yet` };
    } else if (c.drafting) {
      cup = { title: c.name, line: `${c.teams[0].name} vs ${c.teams[1].name} · the draft is on` };
    } else {
      const s = cupScore(c);
      cup = { title: c.name, line: s.played ? `${c.teams[0].name} ${pts(s.a)} – ${pts(s.b)} ${c.teams[1].name}` : `${c.teams[0].name} vs ${c.teams[1].name} · ${s.total ? `${s.total} matches to play` : 'matches not set yet'}` };
    }
  }

  // Who's coming.
  const crew = state.members.map((m) => {
    const parts = m.name.trim().split(/\s+/);
    return { name: parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : m.name, full: m.name, from: m.airport || '', flight: m.flight_price !== null, organizer: m.is_organizer };
  });

  // Highlights: the good stuff, for the group chat.
  const highlights: string[] = [];
  const marquee = rounds.slice().sort((a, b) => (Number(b.data.fee) || 0) - (Number(a.data.fee) || 0))[0];
  if (marquee) highlights.push(`${marquee.data.course}${date.option ? ` on ${dayLabel(date.option.data.start, marquee.data.day).split(' ')[0]}` : ''}`);
  if (rounds.length) highlights.push(`${rounds.length} round${rounds.length === 1 ? '' : 's'} in ${byDay.size} day${byDay.size === 1 ? '' : 's'}${suggested ? ' (so far)' : ''}`);
  if (stay.option && (stay.option.data.bedrooms || 0) >= 3) highlights.push(`${stay.option.data.bedrooms}-bedroom ${/hotel|resort|inn|lodge|suite|room/i.test(stay.option.data.name) ? 'stay' : 'house'}${stay.locked ? '' : ' (leading)'}`);
  else if (stay.option) highlights.push(`Staying at ${stay.option.data.name}${stay.locked ? '' : ' (leading)'}`);
  if (cup) highlights.push(cup.title);
  if (places) highlights.push(`${places.length} places on the table`);

  // What still needs doing, most important first.
  const todo: string[] = [];
  const voted = (kind: string) => {
    const open = state.options.filter((o) => o.kind === kind && !o.locked);
    if (!open.length || state.options.some((o) => o.kind === kind && o.locked)) return [];
    return state.members.filter((m) => !open.some((o) => state.votes.some((v) => v.option_id === o.id && v.member_id === m.id)));
  };
  const deadline = (k: 'date' | 'destination' | 'lodging') => {
    const d = state.trip.deadlines?.[k];
    if (!d) return '';
    const t = new Date(d);
    return Number.isNaN(t.getTime()) ? '' : `, voting closes ${t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };
  // "Ben, Luke, Ryan and 2 more"
  const few = (w: { name: string }[]) => andList([...w.slice(0, w.length > 4 ? 3 : 4).map((m) => first(m.name)), ...(w.length > 4 ? [`${w.length - 3} more`] : [])]);
  const waiting = (w: { name: string }[]) => (w.length ? `. Still to vote: ${few(w)}` : '');
  if (!date.option) todo.push('Suggest some dates');
  else if (!date.locked) { const w = voted('date'); todo.push(`Pick the dates${deadline('date')}${waiting(w)}`); }
  if (!dest.option) todo.push('Suggest a destination');
  else if (!dest.locked) { const w = voted('destination'); todo.push(`Pick the place${dests.length > 1 ? ` from ${dests.length} options` : ''}${deadline('destination')}${waiting(w)}`); }
  if (!stay.option) todo.push('Find a house or hotel');
  else if (!stay.locked) todo.push(`Lock in the stay${deadline('lodging')}`);
  else if (!stay.option.data.booked) todo.push(`Book ${stay.option.data.name}`);
  if (!planned.length) todo.push(rounds.length ? 'Settle the rounds and add them to the plan' : 'Suggest some courses');
  else if (booked < planned.length) todo.push(`Book ${planned.length - booked} tee time${planned.length - booked === 1 ? '' : 's'}`);
  const unpriced = rounds.filter((r) => !Number(r.data.fee)).length;
  if (unpriced) todo.push(`Get prices for ${unpriced} round${unpriced === 1 ? '' : 's'}`);
  if (flown < n) {
    const left = state.members.filter((m) => m.flight_price === null);
    todo.push(`Flights still to pick: ${few(left)}`);
  }
  if (!c && n >= 4) todo.push('Set up the cup (optional)');
  if (!c && n === 2) todo.push('Start match play (optional)');

  return {
    title: state.trip.name,
    subtitle,
    countdown,
    asOf: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    facts, checklist, places, days, daysNote, stay: stayInfo, cost, costNote, crew, cup,
    highlights: highlights.slice(0, 4),
    todo: todo.slice(0, 6),
  };
}
