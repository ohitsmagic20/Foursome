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
}

/** Money someone paid for the group, split equally among `split_with` (everyone when empty). */
export interface Expense { id: string; paid_by: string; amount: number; note: string; split_with: string[]; created_at: string }

/** A date option. `nights` lets one option be a long weekend and another a full week; without it the trip's default applies. */
export interface DateData { start: string; nights?: number }
export interface DestinationData { name: string; airport: string; airports?: string[] }
export const destAirports = (d: DestinationData) => (d.airports?.length ? d.airports : d.airport ? [d.airport] : []);
export interface NearbyAirport { code: string; name: string; city: string; miles: number; major: boolean; suggested: boolean }
export interface LodgingData { name: string; url?: string; image?: string; total: number; bedrooms: number; beds: number; booked?: boolean; owner?: string }
export interface RoundData {
  course: string; day: number; time: string; fee: number; booked?: boolean; checked?: string; checkedAt?: string; weekday?: number; url?: string;
  /** Pairings: member ids per tee time, in order. Group 1 tees off at `time`, each next group 10 minutes later. */
  groups?: string[][];
  /** Added from a trip idea; the fee is an estimate until someone enters a real price. */
  fromTemplate?: string;
  /** Who on the trip is booking this tee time (member id). */
  owner?: string;
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
  preview?: { organizer: string; count: number };
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
export function lockedOf<T>(state: TripState, kind: Kind): Option<T> | null {
  return (optionsOf<T>(state, kind).find((o) => o.locked) as Option<T>) || null;
}
export function leaderOf<T>(state: TripState, kind: Kind): Option<T> | null {
  const opts = optionsOf<T>(state, kind);
  if (!opts.length) return null;
  return opts.slice().sort((a, b) => tally(state, b.id).score - tally(state, a.id).score)[0];
}
/** The locked option if there is one, otherwise the current leader. */
export function pickOf<T>(state: TripState, kind: Kind): { option: Option<T> | null; locked: boolean } {
  const l = lockedOf<T>(state, kind);
  return l ? { option: l, locked: true } : { option: leaderOf<T>(state, kind), locked: false };
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
export function plannedRounds(state: TripState): Option<RoundData>[] {
  return optionsOf<RoundData>(state, 'round').filter((o) => o.locked);
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
export interface CourseTee { name: string; yards: number; rating: number; slope: number }
export interface CourseInfo {
  id: string; name: string; city: string; state: string; access: CourseAccess; lat: number; lon: number; par: number; holes: number; yards: number;
  website: string; phone: string; tees: CourseTee[];
  /** A short description (from Wikipedia, CC BY-SA) and where it came from; facilities like a driving range. */
  architect?: string; built?: number; description?: string; descriptionUrl?: string; facilities?: string[];
}
/** "Rating 72.0–75.6 · Slope 137–146" across the men's tees. */
export function teeSummary(tees: CourseTee[]): string {
  if (!tees.length) return '';
  const r = tees.map((t) => t.rating), sl = tees.map((t) => t.slope);
  const span = (xs: number[], f: (n: number) => string) => (Math.min(...xs) === Math.max(...xs) ? f(xs[0]) : `${f(Math.min(...xs))}–${f(Math.max(...xs))}`);
  return `Rating ${span(r, (n) => n.toFixed(1))} · Slope ${span(sl, String)}`;
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
  const settled = new Set(state.options.filter((o) => o.locked && o.kind !== 'round').map((o) => o.kind));
  for (const o of state.options) {
    if (o.locked || settled.has(o.kind)) continue;
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
export interface CoursePrices { course: string; weekday: PriceRange | null; weekend: PriceRange | null; all: PriceRange | null; latest: string }

/* ---------- accounts ---------- */
export interface Profile { id: string; email: string; name: string; phone: string; home_city: string; airport: string; budget: number; bed: Bed; email_updates?: boolean; venmo?: string; cashapp?: string }
export interface MyTrip { code: string; name: string; nights: number; start: string | null; destination: string | null; members: number; organizer: boolean }
