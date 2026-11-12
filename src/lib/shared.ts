// Types and trip math shared by the server and the browser. No secrets here.

export type Kind = 'date' | 'destination' | 'lodging' | 'round';
export type VoteValue = 'yes' | 'maybe' | 'no';
export type Bed = 'own' | 'share';

export interface Trip {
  id: string;
  code: string;
  name: string;
  nights: number;
  food: number;
  /** When voting closes for each single-winner decision (ISO time). Missing before migration 007. */
  deadlines?: Partial<Record<'date' | 'destination' | 'lodging', string>>;
  /** The Cup (migration 008): null = not set up; missing = database not updated. */
  cup?: Cup | null;
}

export interface Member {
  id: string;
  name: string;
  airport: string;
  budget: number;
  bed: Bed;
  is_organizer: boolean;
  flight_price: number | null;
  flight_summary: string | null;
  flight_arrive_at: string | null;
  flight_depart_at: string | null;
  /** Where to send this person money: Venmo username and Cash App $cashtag (without @ or $). */
  venmo?: string;
  cashapp?: string;
  /** They've bought the flight they picked (migration 007). */
  flight_booked?: boolean;
}

/** Money someone paid for the group, split equally among `split_with` (everyone when empty). */
export interface Expense { id: string; paid_by: string; amount: number; note: string; split_with: string[]; created_at: string }

/** A date option. `nights` lets one option be a long weekend and another a full week; without it the trip's default applies. */
export interface DateData { start: string; nights?: number }
export interface DestinationData { name: string; airport: string; airports?: string[] }
export const destAirports = (d: DestinationData) => (d.airports?.length ? d.airports : d.airport ? [d.airport] : []);
export interface NearbyAirport { code: string; name: string; city: string; miles: number; major: boolean; suggested: boolean }
export interface LodgingData { /** The destination option this stay is for (empty: any place). */ dest?: string; name: string; url?: string; image?: string; total: number; bedrooms: number; beds: number; booked?: boolean; owner?: string; confirmation?: string; rooms?: string[][] }
export interface RoundData {
  /** The destination option this round is for (empty: any place). */
  dest?: string;
  course: string; day: number; time: string; fee: number; booked?: boolean; checked?: string; checkedAt?: string; weekday?: number; url?: string;
  /** Pairings: member ids per tee time, in order. Group 1 tees off at `time`, each next group 10 minutes later. */
  groups?: string[][];
  /** No price was entered: the fee is an estimate (what other groups paid), or 0 for "price TBD". */
  estimate?: boolean;
  /** Added from a trip idea; the fee is an estimate until someone enters a real price. */
  fromTemplate?: string;
  /** Who on the trip is booking this tee time (member id). */
  owner?: string;
  /** Confirmation number from the course, once booked. */
  confirmation?: string;
  /** Picked from the course database: its id, location and how the public can play it. */
  courseId?: string;
  lat?: number;
  lon?: number;
  access?: CourseAccess;
  where?: string;
}

export interface Option<T = unknown> {
  id: string;
  kind: Kind;
  data: T;
  locked: boolean;
  created_by: string | null;
}

export interface Vote { option_id: string; member_id: string; value: VoteValue }

export interface TripState {
  trip: Trip;
  members: Member[];
  expenses?: Expense[];
  /** Set when the organizer shared this trip as a trip idea. */
  sharedIdea?: string;
  options: Option[];
  votes: Vote[];
  meId: string | null;
  /** Only for people who haven't joined: just enough for the invite screen. */
  preview?: { organizer: string; count: number; names?: string[]; place?: string | null; dates?: string | null; placeOptions?: number; dateOptions?: number };
  /** Read-only key for this person's calendar feed. */
  calKey?: string;
  /** Live flight search is on (a live Duffel token). In test mode the app only offers Google Flights and manual entry. */
  flightSearch?: boolean;
}

export interface FlightLeg { depart: string; arrive: string; from: string; to: string; stops: number; carrier: string }
export interface FlightOffer { id: string; price: number; currency: string; airline: string; out: FlightLeg; back: FlightLeg | null }

/* ---------- dates ---------- */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function rangeLabel(startIso: string, nights: number): string {
  const a = parseDay(startIso), b = addDays(a, nights);
  return a.getMonth() === b.getMonth()
    ? `${MON[a.getMonth()]} ${a.getDate()}–${b.getDate()}`
    : `${MON[a.getMonth()]} ${a.getDate()} – ${MON[b.getMonth()]} ${b.getDate()}`;
}
export function dayLabel(startIso: string, dayIndex: number): string {
  const x = addDays(parseDay(startIso), dayIndex - 1);
  return `${DOW[x.getDay()]} ${MON[x.getMonth()]} ${x.getDate()}`;
}
/** "2027-03-11T14:05:00" → "Thu 2:05 PM" (the time is already local to the airport). */
export function clockLabel(iso: string, withDay = true): string {
  const [datePart, timePart = '00:00'] = iso.split('T');
  const d = parseDay(datePart);
  let [h, m] = timePart.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const t = `${h}:${String(m).padStart(2, '0')} ${ap}`;
  return withDay ? `${DOW[d.getDay()]} ${t}` : t;
}
export function teeMinutes(t: string): number {
  const m = String(t).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3] && /pm/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}
export function money(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/* ---------- voting ---------- */
export function votesFor(state: TripState, optionId: string): Record<string, VoteValue> {
  const out: Record<string, VoteValue> = {};
  for (const v of state.votes) if (v.option_id === optionId) out[v.member_id] = v.value;
  return out;
}
export function tally(state: TripState, optionId: string) {
  let yes = 0, maybe = 0, no = 0;
  const vs = votesFor(state, optionId);
  for (const m of state.members) {
    const v = vs[m.id];
    if (v === 'yes') yes++;
    else if (v === 'maybe') maybe++;
    else if (v === 'no') no++;
  }
  const waiting = state.members.length - yes - maybe - no;
  return { yes, maybe, no, waiting, score: yes + maybe * 0.4 - no * 0.2 };
}
export function optionsOf<T>(state: TripState, kind: Kind): Option<T>[] {
  return state.options.filter((o) => o.kind === kind) as Option<T>[];
}

/* ---------- places: stays and rounds belong to one destination ---------- */
const PLACED: Kind[] = ['lodging', 'round'];
/** The destination the trip's plan follows: the locked one, else the one leading the vote. */
export function tripPlace(state: TripState): string | null {
  const ds = optionsOf<DestinationData>(state, 'destination');
  const l = ds.find((d) => d.locked);
  if (l) return l.id;
  if (!ds.length) return null;
  return ds.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score)[0].id;
}
/** Which destination an option is for, or null when it isn't tied to one (or its place was removed). */
export function placeOf(state: TripState, o: Option): string | null {
  const d = (o.data as { dest?: string })?.dest;
  return d && state.options.some((x) => x.id === d && x.kind === 'destination') ? d : null;
}
/** Stays or rounds for one destination (plus any not tied to a place). `place` null means all. */
export function inPlace<T>(state: TripState, kind: Kind, place: string | null): Option<T>[] {
  const all = optionsOf<T>(state, kind);
  if (!place || !PLACED.includes(kind)) return all;
  return all.filter((o) => { const p = placeOf(state, o); return !p || p === place; });
}
const scoped = <T,>(state: TripState, kind: Kind) => inPlace<T>(state, kind, PLACED.includes(kind) ? tripPlace(state) : null);

export function lockedOf<T>(state: TripState, kind: Kind, place?: string | null): Option<T> | null {
  const opts = place !== undefined ? inPlace<T>(state, kind, place) : scoped<T>(state, kind);
  return (opts.find((o) => o.locked) as Option<T>) || null;
}
export function leaderOf<T>(state: TripState, kind: Kind, place?: string | null): Option<T> | null {
  const opts = place !== undefined ? inPlace<T>(state, kind, place) : scoped<T>(state, kind);
  if (!opts.length) return null;
  return opts.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score)[0];
}
/** The locked option if there is one, otherwise the current leader. Stays follow the trip's place. */
export function pickOf<T>(state: TripState, kind: Kind, place?: string | null): { option: Option<T> | null; locked: boolean } {
  const l = lockedOf<T>(state, kind, place);
  return l ? { option: l, locked: true } : { option: leaderOf<T>(state, kind, place), locked: false };
}

/** Nights for one date option. */
export const nightsOf = (trip: Trip, d?: DateData | null) => (d?.nights && d.nights > 0 ? d.nights : trip.nights);
/** Nights for the trip as planned: the locked (or leading) dates, else the trip default. */
export function tripNights(state: TripState): number {
  return nightsOf(state.trip, pickOf<DateData>(state, 'date').option?.data);
}

/* ---------- costs ---------- */
const BED_WEIGHT: Record<Bed, number> = { own: 1, share: 0.75 };

export function bedsNeeded(members: Member[]): number {
  const own = members.filter((m) => m.bed === 'own').length;
  const share = members.length - own;
  return own + Math.ceil(share / 2);
}
export function lodgingShare(members: Member[], total: number, m: Member): number {
  const sum = members.reduce((s, x) => s + BED_WEIGHT[x.bed], 0) || 1;
  return (total * BED_WEIGHT[m.bed]) / sum;
}
export function plannedRounds(state: TripState, place?: string | null): Option<RoundData>[] {
  return (place !== undefined ? inPlace<RoundData>(state, 'round', place) : scoped<RoundData>(state, 'round')).filter((o) => o.locked);
}

/** One destination's whole trip, for comparing places before the group picks one. */
export function placePlan(state: TripState, place: string) {
  const stays = inPlace<LodgingData>(state, 'lodging', place);
  const rounds = inPlace<RoundData>(state, 'round', place);
  const stay = pickOf<LodgingData>(state, 'lodging', place);
  const planned = rounds.filter((r) => r.locked);
  // Without a set plan yet, count the best-liked round per day.
  const best = new Map<number, Option<RoundData>>();
  for (const r of rounds.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score)) if (!best.has(r.data.day)) best.set(r.data.day, r);
  const golfRounds = planned.length ? planned : [...best.values()];
  const n = Math.max(1, state.members.length);
  const stayEach = stay.option ? (Number(stay.option.data.total) || 0) / n : 0;
  const golfEach = golfRounds.reduce((s, r) => s + (Number(r.data.fee) || 0), 0);
  return { stays, rounds, stay: stay.option, stayLocked: stay.locked, golfRounds, golfPlanned: planned.length > 0, stayEach, golfEach, each: stayEach + golfEach };
}
export function costOf(state: TripState, m: Member) {
  const lodging = pickOf<LodgingData>(state, 'lodging').option;
  const stay = lodging ? lodgingShare(state.members, Number(lodging.data.total) || 0, m) : 0;
  const golf = plannedRounds(state).reduce((s, r) => s + (Number(r.data.fee) || 0), 0);
  const flight = Number(m.flight_price) || 0;
  const food = state.trip.food || 0;
  return { flight, stay, golf, food, total: flight + stay + golf + food };
}
export const teeTimesNeeded = (n: number) => Math.max(1, Math.ceil(n / 4));

/* ---------- settle up ---------- */
/** Each person's balance (positive: they're owed money) and the fewest payments that even everyone out. */
export function settleUp(state: TripState) {
  const ids = state.members.map((m) => m.id);
  const cents = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const e of state.expenses || []) {
    const among = (e.split_with?.length ? e.split_with : ids).filter((id) => cents.has(id));
    if (!among.length || !cents.has(e.paid_by)) continue;
    const total = Math.round(Number(e.amount) * 100);
    const share = Math.floor(total / among.length);
    let rest = total - share * among.length; // leftover cents go to the first people in the split
    cents.set(e.paid_by, cents.get(e.paid_by)! + total);
    for (const id of among) { cents.set(id, cents.get(id)! - share - (rest > 0 ? 1 : 0)); if (rest > 0) rest--; }
  }
  const owed = [...cents].filter(([, c]) => c > 0).map(([id, c]) => ({ id, c })).sort((a, b) => b.c - a.c);
  const owes = [...cents].filter(([, c]) => c < 0).map(([id, c]) => ({ id, c: -c })).sort((a, b) => b.c - a.c);
  const payments: { from: string; to: string; amount: number }[] = [];
  while (owed.length && owes.length) {
    const a = owes[0], b = owed[0];
    const amt = Math.min(a.c, b.c);
    if (amt > 0) payments.push({ from: a.id, to: b.id, amount: amt / 100 });
    a.c -= amt; b.c -= amt;
    if (!a.c) owes.shift();
    if (!b.c) owed.shift();
  }
  const total = (state.expenses || []).reduce((s, e) => s + Number(e.amount), 0);
  return { balance: new Map([...cents].map(([id, c]) => [id, c / 100])), payments, total };
}
/** Pay links that open Venmo or Cash App with the amount filled in. */
export const venmoLink = (handle: string, amount: number, note: string) =>
  `https://venmo.com/?txn=pay&audience=private&recipients=${encodeURIComponent(handle)}&amount=${amount.toFixed(2)}&note=${encodeURIComponent(note)}`;
export const cashAppLink = (tag: string, amount: number) => `https://cash.app/$${encodeURIComponent(tag)}/${amount.toFixed(2)}`;
export const payHandle = (v: unknown) => String(v ?? '').trim().replace(/^[@$]+/, '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 30);

/* ---------- pairings ---------- */
/** Group i's tee time: the round's time plus 10 minutes per group. */
export function teeAfter(time: string, i: number): string {
  if (!/\d{1,2}:\d{2}/.test(time)) return `Group ${i + 1}`;
  const t = teeMinutes(time) + i * 10;
  const h24 = Math.floor(t / 60) % 24, m = t % 60;
  return formatTee(h24 % 12 || 12, m, h24 >= 12 ? 'PM' : 'AM');
}
/** Saved pairings as "Al, Bo, Cy, Di" per group, skipping people who left. */
export function groupNames(state: TripState, groups?: string[][]): string[] {
  return (groups || []).map((g) => g.map((id) => state.members.find((m) => m.id === id)?.name.split(/\s+/)[0]).filter(Boolean).join(', ')).filter(Boolean);
}
/** Split people into foursomes as evenly as possible (9 → 3,3,3 rather than 4,4,1), shuffled. */
export function autoGroups(ids: string[]): string[][] {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const n = Math.max(1, Math.ceil(a.length / 4));
  const out: string[][] = Array.from({ length: n }, () => []);
  a.forEach((id, i) => out[i % n].push(id));
  return out;
}

/* ---------- weather and courses (from /api/weather and /api/courses) ---------- */
export interface WeatherDay { date: string; hi: number | null; lo: number | null; rain: number | null; wind: number | null }
export interface WeatherReport {
  mode: 'forecast' | 'typical';
  years: number;              // how many past years the "typical" numbers average
  days: WeatherDay[];
  hi: number | null; lo: number | null; rain: number | null; wind: number | null;
  verdict: 'good' | 'mixed' | 'wet' | 'cold' | 'hot';
  place?: string;
}
/** How the public can play a course: from the course database (blank when unknown). */
export type CourseAccess = 'public' | 'semi-private' | 'private' | 'resort' | 'municipal' | '';
export const ACCESS_LABEL: Record<CourseAccess, string> = {
  public: 'Public', 'semi-private': 'Semi-private', private: 'Private', resort: 'Resort', municipal: 'Municipal', '': '',
};
export interface CourseHit { id: string; name: string; city: string; state: string; access: CourseAccess; lat: number; lon: number; website: string; miles?: number }
export interface CourseTee { name: string; color?: string; yards: number; rating: number; slope: number }
export interface CourseInfo {
  id: string; name: string; city: string; state: string; access: CourseAccess; lat: number; lon: number; par: number; holes: number; yards: number;
  website: string; phone: string; tees: CourseTee[];
}
export interface NearbyCourse { name: string; miles: number; website: string; phone: string; holes: string; isPrivate: boolean; lat: number; lon: number }

/* ---------- prefilled searches on booking sites ---------- */
export function lodgingSearchLinks(dest: string, checkIn: string, nights: number, guests: number, minBedrooms: number) {
  const out = isoDay(addDays(parseDay(checkIn), nights));
  const q = encodeURIComponent(dest);
  const rooms = Math.max(1, minBedrooms);
  return [
    { site: 'Airbnb', kind: 'Houses', url: `https://www.airbnb.com/s/${q}/homes?checkin=${checkIn}&checkout=${out}&adults=${guests}&min_bedrooms=${rooms}` },
    { site: 'Vrbo', kind: 'Houses', url: `https://www.vrbo.com/search?destination=${q}&startDate=${checkIn}&endDate=${out}&adults=${guests}&minBedrooms=${rooms}` },
    { site: 'Booking.com', kind: 'Hotels', url: `https://www.booking.com/searchresults.html?ss=${q}&checkin=${checkIn}&checkout=${out}&group_adults=${guests}&no_rooms=${Math.ceil(guests / 2)}` },
    { site: 'Expedia', kind: 'Hotels', url: `https://www.expedia.com/Hotel-Search?destination=${q}&startDate=${checkIn}&endDate=${out}&adults=${guests}` },
  ];
}

/** Open options that still need my vote, by kind. A kind with a locked winner has nothing open (except rounds, which lock one by one). */
export function openVotes(state: TripState): Record<Kind, number> {
  const out: Record<Kind, number> = { date: 0, destination: 0, lodging: 0, round: 0 };
  if (!state.meId) return out;
  const dest = state.options.find((o) => o.kind === 'destination' && o.locked);
  // A kind is settled once something's locked: dates and places trip-wide, a stay per place.
  const settled = (o: Option) => state.options.some((x) => x.locked && x.kind === o.kind && x.kind !== 'round' && (o.kind !== 'lodging' || (placeOf(state, x) || '') === (placeOf(state, o) || '')));
  for (const o of state.options) {
    if (o.locked || settled(o)) continue;
    // Once the place is picked, other places' stays and rounds are off the table.
    if (dest && PLACED.includes(o.kind)) { const p = placeOf(state, o); if (p && p !== dest.id) continue; }
    if (!state.votes.some((v) => v.option_id === o.id && v.member_id === state.meId)) out[o.kind]++;
  }
  return out;
}

/* ---------- tee times ---------- */
export function parseTee(t: string | undefined): { h: number; m: number; ap: 'AM' | 'PM' } {
  const x = String(t || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!x) return { h: 9, m: 0, ap: 'AM' };
  let h = Number(x[1]);
  let ap: 'AM' | 'PM' = x[3] ? (x[3].toUpperCase() as 'AM' | 'PM') : h >= 12 ? 'PM' : 'AM';
  if (!x[3] && h > 12) h -= 12;
  if (h === 0) { h = 12; ap = 'AM'; }
  return { h: Math.min(12, Math.max(1, h)), m: Math.min(59, Math.max(0, Number(x[2]))), ap };
}
export const formatTee = (h: number, m: number, ap: string) => `${h}:${String(m).padStart(2, '0')} ${ap}`;
/** Fri, Sat and Sun are weekend rates at most courses. */
export const isWeekendDay = (weekday: number) => weekday === 0 || weekday === 5 || weekday === 6;

export interface PriceRange { low: number; high: number; median: number; count: number }
export interface CoursePrices { course: string; weekday: PriceRange | null; weekend: PriceRange | null; all: PriceRange | null; latest: string; /** 'groups': what Foresome groups paid; 'idea': the typical fee from a trip idea. */ source?: 'groups' | 'idea' }

/** How pricey a round is: $ up to $70, $$ up to $120, $$$ above. Null when there's no price. */
export function priceTier(fee: number | null | undefined): '$' | '$$' | '$$$' | null {
  const f = Number(fee) || 0;
  if (f <= 0) return null;
  return f <= 70 ? '$' : f <= 120 ? '$$' : '$$$';
}
export const TIER_HINT: Record<string, string> = { $: 'About $20–70 a round', $$: 'About $70–120 a round', $$$: 'Over $120 a round' };

/* ---------- accounts ---------- */
export interface Profile { id: string; email: string; name: string; phone: string; home_city: string; airport: string; budget: number; bed: Bed; email_updates?: boolean; venmo?: string; cashapp?: string }
export interface MyTrip { code: string; name: string; nights: number; start: string | null; destination: string | null; members: number; organizer: boolean }

/** Time to get bags, a car and to the course after landing. */
export const LANDING_BUFFER_MIN = 90;

/** The first planned tee time on arrival day, if there's one and the dates are known. */
export function firstTee(state: TripState): { start: string; time: string } | null {
  const start = pickOf<DateData>(state, 'date').option?.data.start;
  if (!start) return null;
  const r = plannedRounds(state).filter((x) => x.data.day === 1).sort((a, b) => teeMinutes(a.data.time) - teeMinutes(b.data.time))[0];
  return r ? { start, time: r.data.time } : null;
}

/** True when a flight landing at `arriveIso` (local time) won't make the first tee time. */
export function landsTooLate(state: TripState, arriveIso: string | null | undefined): boolean {
  const tee = firstTee(state);
  if (!tee || !arriveIso) return false;
  const [d, t = '00:00'] = arriveIso.split('T');
  if (d > tee.start) return true;
  if (d < tee.start) return false;
  const [h, mi] = t.split(':').map(Number);
  return h * 60 + mi + LANDING_BUFFER_MIN > teeMinutes(tee.time);
}

/* ---------- shared rides from the airport ---------- */
/** Minutes apart that two arrivals can still share a ride. */
export const RIDE_WINDOW_MIN = 60;

/** Where someone lands: from the route in their flight summary ("ORD→MYR"), else the destination's only airport. */
export function arrivalAirport(m: Member, destAirportsList: string[]): string | null {
  const hit = (m.flight_summary || '').match(/→\s*([A-Z]{3})\b/);
  if (hit) return hit[1];
  return destAirportsList.length === 1 ? destAirportsList[0] : null;
}

export interface RideGroup { airport: string; day: string; members: Member[]; from: string; to: string }

/** People landing at the same airport within an hour of the last one, two or more to a group. */
export function rideGroups(members: Member[], destAirportsList: string[]): RideGroup[] {
  const mins = (iso: string) => { const [d, t = '00:00'] = iso.split('T'); const [h, mi] = t.split(':').map(Number); return Date.parse(`${d}T00:00:00Z`) / 60000 + h * 60 + mi; };
  const byPort = new Map<string, Member[]>();
  for (const m of members) {
    if (!m.flight_arrive_at || m.flight_summary === 'Driving') continue;
    const port = arrivalAirport(m, destAirportsList);
    if (!port) continue;
    byPort.set(port, [...(byPort.get(port) || []), m]);
  }
  const out: RideGroup[] = [];
  for (const [port, list] of byPort) {
    const sorted = list.slice().sort((a, b) => a.flight_arrive_at!.localeCompare(b.flight_arrive_at!));
    let cur: Member[] = [];
    const flush = () => { if (cur.length >= 2) out.push({ airport: port, day: cur[0].flight_arrive_at!.slice(0, 10), members: cur, from: cur[0].flight_arrive_at!, to: cur[cur.length - 1].flight_arrive_at! }); cur = []; };
    for (const m of sorted) {
      if (cur.length && mins(m.flight_arrive_at!) - mins(cur[cur.length - 1].flight_arrive_at!) > RIDE_WINDOW_MIN) flush();
      cur.push(m);
    }
    flush();
  }
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

/** "Joe", "Joe and Dan", "Joe, Dan and Chris". */
export function andList(items: string[]): string {
  const a = items.filter(Boolean);
  return a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
}

/* ---------- rooms ---------- */
/** Suggested rooms: everyone alone if there's space; otherwise people who want their own bed get one each and sharers pair up. If there aren't
 *  enough rooms, the extra people double up in the emptiest rooms (sharers first). */
export function autoRooms(members: Member[], bedrooms: number): string[][] {
  const n = Math.max(1, bedrooms);
  const rooms: string[][] = Array.from({ length: n }, () => []);
  if (members.length <= n) return rooms.map((r, i) => (members[i] ? [members[i].id] : []));
  const own = members.filter((m) => m.bed === 'own').map((m) => m.id);
  const share = members.filter((m) => m.bed !== 'own').map((m) => m.id);
  let i = 0;
  for (const id of own) { if (i < n) rooms[i++].push(id); else share.push(id); }
  for (let k = 0; k < share.length; k += 2) {
    const pair = share.slice(k, k + 2);
    if (i < n) rooms[i++].push(...pair);
    else for (const id of pair) rooms.slice().sort((a, b) => a.length - b.length)[0].push(id);
  }
  return rooms;
}

/* ---------- what to pack ---------- */
/** Forecast-based packing tips for the trip's days, most useful first. Only from a real forecast. */
export function packingTips(days: WeatherDay[], start: string, rounds: { day: number; time: string }[]): string[] {
  const tips: { score: number; text: string }[] = [];
  const dayOf = (iso: string) => Math.round((parseDay(iso).getTime() - parseDay(start).getTime()) / 864e5) + 1;
  const label = (iso: string) => DOW[parseDay(iso).getDay()];
  const cold = days.filter((d) => d.lo !== null && d.lo <= 50 && rounds.some((r) => r.day === dayOf(d.date) && teeMinutes(r.time) < 11 * 60));
  if (cold.length) {
    const c = cold.slice().sort((a, b) => a.lo! - b.lo!)[0];
    const r = rounds.filter((x) => x.day === dayOf(c.date)).sort((a, b) => teeMinutes(a.time) - teeMinutes(b.time))[0];
    tips.push({ score: 3, text: `Layers: about ${c.lo}° for the ${r.time} tee ${label(c.date)}.` });
  }
  const wet = days.filter((d) => (d.rain ?? 0) >= 40).sort((a, b) => b.rain! - a.rain!);
  if (wet.length) tips.push({ score: 3, text: `Rain gear: ${wet[0].rain}% chance ${andList(wet.slice(0, 2).sort((a, b) => a.date.localeCompare(b.date)).map((d) => label(d.date)))}${wet.length > 2 ? ' and more' : ''}.` });
  const hot = days.filter((d) => (d.hi ?? 0) >= 88).sort((a, b) => b.hi! - a.hi!);
  if (hot.length) tips.push({ score: 2, text: `Sunscreen and extra water: up to ${hot[0].hi}° ${label(hot[0].date)}.` });
  const windy = days.filter((d) => (d.wind ?? 0) >= 18).sort((a, b) => b.wind! - a.wind!);
  if (windy.length) tips.push({ score: 1, text: `Windy ${label(windy[0].date)} (${windy[0].wind} mph): a windbreaker and a few extra balls.` });
  return tips.sort((a, b) => b.score - a.score).map((t) => t.text).slice(0, 4);
}

/* ---------- the Cup: team match play, Internet Invitational style ---------- */
export type CupFormat = 'scramble' | 'alt' | 'bestball' | 'singles';
export const CUP_FORMATS: Record<CupFormat, { label: string; per: number; blurb: string }> = {
  scramble: { label: 'Scramble', per: 2, blurb: 'Both hit, play the better shot. Low pressure.' },
  alt: { label: 'Alternate shot', per: 2, blurb: 'One ball, take turns. Pressure on every swing.' },
  bestball: { label: 'Best ball', per: 2, blurb: 'Everyone plays their own ball; the better score on each hole counts.' },
  singles: { label: 'Singles', per: 1, blurb: 'One on one. No one to hide behind.' },
};
export const CUP_MARGINS = ['1 up', '2 up', '2&1', '3&1', '3&2', '4&2', '4&3', '5&3', '5&4', '6&4', '6&5', '7&5', '7&6', '8&6', '8&7', '9&8', '10&8'];
export interface CupTeam { name: string; captain: string; members: string[] }
export type CupResult = 'a' | 'b' | 'half';
/** Who won one hole of a match: side a, side b, or halved. null = not entered yet. */
export type HoleWin = CupResult | null;
export interface CupMatch {
  id: string; round: string; format: CupFormat; holes: 9 | 18; a: string[]; b: string[]; result?: CupResult | null; margin?: string; twice?: string[];
  /** Hole-by-hole: index 0 is hole 1. */
  play?: HoleWin[];
  /** True when the result came from the hole-by-hole scorecard (so editing a hole can reopen the match). */
  auto?: boolean;
}
/** `v` counts changes, so two phones saving at once can't overwrite each other. */
export interface Cup { name: string; teams: [CupTeam, CupTeam]; drafting: boolean; matches: CupMatch[]; sitting?: Record<string, string[]>; v?: number }

/** Where a match stands from its hole-by-hole card: holes up (positive = side a), holes entered, and whether it's over. */
export function matchStatus(m: CupMatch) {
  // Walk the holes in order and stop the moment it's decided (a 10&8 rout doesn't keep counting).
  let lead = 0, thru = 0, last = 0, decided = false;
  for (let i = 0; i < m.holes; i++) {
    const h = m.play?.[i];
    if (!h) continue;
    thru++; last = i + 1;
    if (h === 'a') lead++; else if (h === 'b') lead--;
    const left = m.holes - thru;
    if (Math.abs(lead) > left || left === 0) { decided = true; break; }
  }
  const remaining = m.holes - thru;
  const result: CupResult | null = decided ? (lead > 0 ? 'a' : lead < 0 ? 'b' : 'half') : null;
  const margin = decided && lead !== 0 ? (remaining === 0 ? `${Math.abs(lead)} up` : `${Math.abs(lead)}&${remaining}`) : undefined;
  const dormie = !decided && lead !== 0 && Math.abs(lead) === remaining;
  return { lead, thru, last, remaining, decided, result, margin, dormie, started: thru > 0 };
}

/** "2 UP thru 7", "All square thru 3", "Dormie (3 UP, 3 to play)", for side names given. */
export function statusLabel(m: CupMatch, sideA: string, sideB: string): string {
  const s = matchStatus(m);
  if (!s.started) return 'Not started';
  if (s.decided) return s.result === 'half' ? 'Halved' : `${s.result === 'a' ? sideA : sideB} won, ${s.margin}`;
  if (s.lead === 0) return `All square thru ${s.thru}`;
  const who = s.lead > 0 ? sideA : sideB;
  return s.dormie ? `${who} dormie, ${Math.abs(s.lead)} UP with ${s.remaining} to play` : `${who} ${Math.abs(s.lead)} UP thru ${s.thru}`;
}

/** Points if every match in progress ended now: the leader takes the point, all square splits it. */
export function cupLive(cup: Cup) {
  const done = cupScore(cup);
  let a = done.a, b = done.b, live = 0;
  for (const m of cup.matches) {
    if (m.result) continue;
    const s = matchStatus(m);
    if (!s.started) continue;
    live++;
    if (s.lead > 0) a++; else if (s.lead < 0) b++; else { a += 0.5; b += 0.5; }
  }
  return { a, b, live };
}

/** Team points so far (1 a win, ½ a half), points on the table, and what clinches it. */
export function cupScore(cup: Cup) {
  let a = 0, b = 0, played = 0;
  for (const m of cup.matches) {
    if (!m.result) continue;
    played++;
    if (m.result === 'a') a++; else if (m.result === 'b') b++; else { a += 0.5; b += 0.5; }
  }
  const total = cup.matches.length;
  return { a, b, played, total, toWin: total / 2 + 0.5, left: total - played };
}

/** "4½" */
export const pts = (n: number) => `${Math.floor(n) || (n % 1 ? '' : '0')}${n % 1 ? '½' : ''}`;

/** Points each player has earned for their team. */
export function cupPlayerPoints(cup: Cup): Map<string, { pts: number; played: number; w: number; l: number; h: number }> {
  const out = new Map<string, { pts: number; played: number; w: number; l: number; h: number }>();
  const add = (id: string, p: number, r: 'w' | 'l' | 'h') => { const x = out.get(id) || { pts: 0, played: 0, w: 0, l: 0, h: 0 }; x.pts += p; x.played++; x[r]++; out.set(id, x); };
  for (const m of cup.matches) {
    if (!m.result) continue;
    for (const id of m.a) add(id, m.result === 'a' ? 1 : m.result === 'half' ? 0.5 : 0, m.result === 'a' ? 'w' : m.result === 'half' ? 'h' : 'l');
    for (const id of m.b) add(id, m.result === 'b' ? 1 : m.result === 'half' ? 0.5 : 0, m.result === 'b' ? 'w' : m.result === 'half' ? 'h' : 'l');
  }
  return out;
}

/** Whose pick it is in a snake draft (A, B, B, A, A, B…), counting picks after the captains. */
export function draftTurn(cup: Cup): 0 | 1 {
  const picks = cup.teams[0].members.length + cup.teams[1].members.length - 2;
  return ([0, 1, 1, 0] as const)[picks % 4];
}

/** Seeded shuffle, so "Shuffle" gives new partners but the server and the app agree. */
export function seededShuffle<T>(list: T[], seed: number): T[] {
  const a = list.slice();
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Matches for one round: each team split into sides of 1 or 2, side i of A against side i of B.
 *  The bigger team sets the number of matches; on the smaller team, players fill the extra slots by
 *  playing a second match (listed in `twice`). An odd player out on a team sits and plays first next time. */
export function buildMatches(cup: Cup, round: string, format: CupFormat, holes: 9 | 18, seed: number): { matches: CupMatch[]; sitting: string[] } {
  const per = CUP_FORMATS[format].per;
  const [ta, tb] = cup.teams.map((t, i) => seededShuffle(t.members, seed + i * 7919));
  const sat = new Set(Object.values(cup.sitting || {}).flat());
  const first = (l: string[]) => [...l.filter((id) => sat.has(id)), ...l.filter((id) => !sat.has(id))];
  const a = first(ta), b = first(tb);
  const sides = (l: string[]) => Math.floor(l.length / per);
  const n = Math.min(Math.max(sides(a), sides(b)), 12);
  if (!n || sides(a) === 0 || sides(b) === 0) return { matches: [], sitting: [...a, ...b] };
  // Fill n sides for a team, reusing its players (fewest matches first) when it's short.
  const fill = (l: string[]) => {
    const own = sides(l) * per;
    const slots = l.slice(0, own);
    const uses = new Map<string, number>(slots.map((id) => [id, 1]));
    while (slots.length < n * per) {
      const side = slots.slice(Math.floor(slots.length / per) * per);
      const next = l.filter((id) => !side.includes(id)).sort((x, y) => (uses.get(x) || 0) - (uses.get(y) || 0))[0];
      slots.push(next);
      uses.set(next, (uses.get(next) || 0) + 1);
    }
    return { slots, left: l.slice(own).filter((id) => !uses.has(id)) };
  };
  const fa = fill(a), fb = fill(b);
  const seen = new Set<string>();
  const matches: CupMatch[] = Array.from({ length: n }, (_, i) => {
    const sa = fa.slots.slice(i * per, i * per + per), sb = fb.slots.slice(i * per, i * per + per);
    const twice = [...sa, ...sb].filter((id) => seen.has(id));
    [...sa, ...sb].forEach((id) => seen.add(id));
    return { id: `${round.slice(0, 8)}-${seed.toString(36)}-${i}`, round, format, holes, a: sa, b: sb, result: null, ...(twice.length ? { twice } : {}) };
  });
  return { matches, sitting: [...fa.left, ...fb.left] };
}

/** Tee-time groups from matches: a 2-v-2 match is a foursome; two singles matches share a tee time. */
export function groupsFromMatches(matches: CupMatch[], sitting: string[] = []): string[][] {
  const groups: string[][] = [];
  const placed = new Set<string>();
  for (const m of matches) {
    const players = [...m.a, ...m.b].filter((id) => !placed.has(id));
    players.forEach((id) => placed.add(id));
    const last = groups[groups.length - 1];
    if (last && last.length + players.length <= 4) last.push(...players); else groups.push(players);
  }
  for (const id of sitting) {
    const open = groups.find((g) => g.length < 4);
    if (open) open.push(id); else groups.push([id]);
  }
  return groups;
}
