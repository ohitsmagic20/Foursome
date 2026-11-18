// Small trips for the tests: build only what each test needs.
import type { Cup, Member, Option, TripState } from '@/lib/shared';

export const member = (i: number, extra: Partial<Member> = {}): Member => ({
  id: `m${i}`, name: `Player${i} Last${i}`, airport: 'ORD', budget: 2000, bed: 'share', is_organizer: i === 1,
  flight_price: null, flight_summary: null, flight_arrive_at: null, flight_depart_at: null, ...extra,
} as Member);

export function trip(n: number, options: Option[] = [], extra: Partial<TripState['trip']> = {}): TripState {
  return {
    trip: { id: 't', code: 'test', name: 'Test Trip', nights: 3, food: 100, deadlines: {}, cup: null, ...extra },
    members: Array.from({ length: n }, (_, i) => member(i + 1)),
    options, votes: [], meId: 'm1',
  } as TripState;
}

let k = 0;
export const opt = (kind: Option['kind'], data: Record<string, unknown>, locked = false): Option => ({ id: `o${++k}`, kind, data, locked, created_by: 'm1' } as unknown as Option);

export const duel = (extra: Partial<Cup> = {}): Cup => ({
  name: 'A vs B', teams: [{ name: 'A', captain: 'a', members: ['a'] }, { name: 'B', captain: 'b', members: ['b'] }],
  drafting: false, matches: [], sitting: {}, duel: true, ...extra,
});
