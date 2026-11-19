import { describe, expect, it } from 'vitest';
import { buildOnePager } from '@/lib/onepager';
import { opt, trip } from './fixtures';

describe('trip one-pager', () => {
  it('works for a brand-new trip with nothing decided', () => {
    const d = buildOnePager(trip(3), new Date('2026-11-18T12:00:00'));
    expect(d.facts.map((f) => f.value)).toEqual(['TBD', 'TBD', '3', '$100']); // just the food budget so far
    expect(d.todo.slice(0, 2)).toEqual(['The organizer sets the dates', 'The organizer sets the destination']);
    expect(d.days).toHaveLength(0);
  });
  it('caps lists so a big trip fits on one page', () => {
    const dest = opt('destination', { name: 'Scottsdale, AZ' }, true);
    const date = opt('date', { start: '2027-03-11', nights: 5 }, true);
    const rounds = Array.from({ length: 14 }, (_, i) => opt('round', { course: `Course ${i}`, day: (i % 6) + 1, time: '9:00 AM', fee: 100 }, true));
    const d = buildOnePager(trip(24, [dest, date, ...rounds]), new Date('2026-11-18T12:00:00'));
    expect(d.days.reduce((t, x) => t + x.rounds.length, 0)).toBeLessThanOrEqual(8);
    expect(d.daysNote).toMatch(/^Showing 8 of 14 rounds/);
    expect(d.todo.length).toBeLessThanOrEqual(6);
    expect(d.countdown).toBe('113 days out');
  });
  it('shows the leading round each day before any are in the plan', () => {
    const rounds = [opt('round', { course: 'A', day: 1, time: '9:00 AM', fee: 50 }), opt('round', { course: 'B', day: 1, time: '10:00 AM', fee: 90 })];
    const t = trip(2, rounds);
    t.votes = [{ option_id: rounds[1].id, member_id: 'm1', value: 'yes' } as never];
    const d = buildOnePager(t);
    expect(d.days[0].rounds.map((r) => r.course)).toEqual(['B']);
    expect(d.daysNote).toMatch(/best-liked/);
  });
});
