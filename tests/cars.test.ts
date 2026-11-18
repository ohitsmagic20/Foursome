import { describe, expect, it } from 'vitest';
import { carShare, costOf, type TripState } from '@/lib/shared';

const state = (cars: TripState['trip']['cars']): TripState => ({
  trip: { id: 't', code: 'c', name: 'T', nights: 3, food: 0, cars },
  members: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id, airport: 'ORD', budget: 0, bed: 'share', is_organizer: id === 'a', flight_price: 300, flight_summary: null, flight_arrive_at: null, flight_depart_at: null })),
  options: [], votes: [], expenses: [], meId: 'a',
} as unknown as TripState);

describe('rental cars', () => {
  it('splits each car between its riders and adds it to the total', () => {
    const s = state([{ id: '1', company: 'Hertz', total: 400, riders: ['a', 'b', 'c', 'd'], by: 'a' }, { id: '2', company: '', total: 150, riders: ['d', 'e'], by: 'e' }]);
    const m = (id: string) => s.members.find((x) => x.id === id)!;
    expect(carShare(s, m('a'))).toBe(100);
    expect(carShare(s, m('d'))).toBe(175);
    expect(carShare(s, m('e'))).toBe(75);
    expect(costOf(s, m('a'))).toMatchObject({ car: 100, total: 400 });
  });
  it('costs nothing without cars, or before the database has them', () => {
    expect(costOf(state(null), state(null).members[0]).car).toBe(0);
    expect(costOf(state(undefined), state(undefined).members[0]).total).toBe(300);
  });
});
