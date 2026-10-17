// Types and trip math shared by the server and the browser. No secrets here.

export type Kind = 'date' | 'destination' | 'lodging' | 'round';
export type VoteValue = 'yes' | 'maybe' | 'no';
export type Bed = 'own' | 'share';

export interface Trip {
  id: string;
  code: string;
  name: string;
  nights: number;
  deposit: number;
  food: number;
}

export interface Member {
  id: string;
  name: string;
  airport: string;
  budget: number;
  bed: Bed;
  is_organizer: boolean;
  paid: boolean;
  flight_price: number | null;
  flight_summary: string | null;
  flight_arrive_at: string | null;
  flight_depart_at: string | null;
}

export interface DateData { start: string }
export interface DestinationData { name: string; airport: string; airports?: string[] }
export const destAirports = (d: DestinationData) => (d.airports?.length ? d.airports : d.airport ? [d.airport] : []);
export interface NearbyAirport { code: string; name: string; city: string; miles: number; major: boolean; suggested: boolean }
export interface LodgingData { name: string; url?: string; image?: string; total: number; bedrooms: number; beds: number }
export interface RoundData { course: string; day: number; time: string; fee: number; booked?: boolean; checked?: string }

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
  options: Option[];
  votes: Vote[];
  meId: string | null;
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
