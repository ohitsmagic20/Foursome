import { describe, expect, it } from 'vitest';
import { inPlace, pickOf, placePlan, plannedRounds, priceTier, tripPlace } from '@/lib/shared';
import { opt, trip } from './fixtures';

describe('places: stays and rounds per destination', () => {
  const az = opt('destination', { name: 'Scottsdale, AZ' });
  const al = opt('destination', { name: 'Gulf Shores, AL' });
  const azStay = opt('lodging', { dest: az.id, name: 'AZ house', total: 4000 });
  const alStay = opt('lodging', { dest: al.id, name: 'AL house', total: 2000 });
  const anyStay = opt('lodging', { name: 'Old untagged stay', total: 3000 });
  const azRound = opt('round', { dest: az.id, course: 'TPC', day: 1, time: '9:00 AM', fee: 300 }, true);
  const alRound = opt('round', { dest: al.id, course: 'Kiva Dunes', day: 1, time: '9:00 AM', fee: 120 });
  const t = trip(4, [az, al, azStay, alStay, anyStay, azRound, alRound]);
  t.votes = [{ option_id: al.id, member_id: 'm1', value: 'yes' } as never];

  it('follows the leading place before one is locked', () => {
    expect(tripPlace(t)).toBe(al.id);
    expect(plannedRounds(t)).toHaveLength(0);
  });
  it('lists a place’s own options plus untagged ones', () => {
    expect(inPlace(t, 'lodging', az.id).map((o) => o.id)).toEqual([azStay.id, anyStay.id]);
  });
  it('switches the plan when a place is locked', () => {
    const locked = { ...t, options: t.options.map((o) => (o.id === az.id ? { ...o, locked: true } : o)) };
    expect(tripPlace(locked)).toBe(az.id);
    expect(plannedRounds(locked).map((r) => r.id)).toEqual([azRound.id]);
    expect(pickOf(locked, 'lodging').option?.id).not.toBe(alStay.id);
  });
  it('prices each place’s whole trip per person', () => {
    const p = placePlan(t, al.id);
    expect(p.golfEach).toBe(120);
    expect(p.golfPlanned).toBe(false);
  });
  it('tiers greens fees', () => {
    expect([priceTier(0), priceTier(45), priceTier(70), priceTier(71), priceTier(120), priceTier(121)]).toEqual([null, '$', '$', '$$', '$$', '$$$']);
  });
});
