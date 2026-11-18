import { describe, expect, it } from 'vitest';
import { buildMatches, cupLive, cupScore, duelRecord, groupsFromMatches, marginsFor, matchStatus, matchStrokes, segLabel, statusLabel } from '@/lib/shared';
import type { CupMatch, HoleWin } from '@/lib/shared';
import { duel } from './fixtures';

const m = (holes: number, play: HoleWin[], from?: number): CupMatch => ({ id: 'x', round: 'r', format: 'singles', holes, from, a: ['a'], b: ['b'], play });

describe('match status', () => {
  it('stops counting once the match is decided', () => {
    const s = matchStatus(m(18, Array(16).fill('a')));
    expect(s.decided).toBe(true);
    expect(s.margin).toBe('10&8');
    expect(s.thru).toBe(10);
  });
  it('closes out on the last hole as "n up"', () => {
    expect(matchStatus(m(18, [...Array(17).fill('half'), 'a'])).margin).toBe('1 up');
  });
  it('halves when all square after every hole', () => {
    const s = matchStatus(m(9, Array(9).fill('half')));
    expect(s.result).toBe('half');
    expect(s.margin).toBeUndefined();
  });
  it('knows dormie', () => {
    expect(matchStatus(m(18, [...Array(14).fill('half'), 'a', 'a'])).dormie).toBe(true);
  });
  it('names the course hole in back-nine status', () => {
    expect(statusLabel(m(9, ['a', 'a', 'half', 'half'], 10), 'Matt', 'Joe')).toBe('Matt 2 UP thru 13');
  });
});

describe('splitting rounds into matches', () => {
  const cup = duel();
  it('makes front and back nines from an 18', () => {
    const ms = buildMatches(cup, 'round-1', 'singles', 18, 1, 9).matches;
    expect(ms.map((x) => [x.from || 1, x.holes])).toEqual([[1, 9], [10, 9]]);
    expect(ms.map((x) => segLabel(x))).toEqual(['Front 9', 'Back 9']);
  });
  it('makes three 6-hole matches', () => {
    const ms = buildMatches(cup, 'round-1', 'singles', 18, 1, 6).matches;
    expect(ms.map((x) => segLabel(x))).toEqual(['Holes 1–6', 'Holes 7–12', 'Holes 13–18']);
  });
  it('makes one tee-time group per pairing, not per segment', () => {
    const ms = buildMatches(cup, 'round-1', 'singles', 18, 1, 6).matches;
    expect(groupsFromMatches(ms, [])).toHaveLength(1);
  });
  it('only offers margins that can happen', () => {
    expect(marginsFor(6)).toContain('2&1');
    expect(marginsFor(6)).not.toContain('5&4');
    expect(marginsFor(9)).toContain('5&4');
    expect(marginsFor(9)).not.toContain('6&3');
  });
});

describe('records and points', () => {
  it('counts a duel record and holes won', () => {
    const cup = duel({ matches: [
      { ...m(9, ['a', 'a', 'a', 'a', 'a']), result: 'a' },
      { ...m(9, ['b']), result: 'b' },
      { ...m(9, []), result: 'half' },
    ] });
    const r = duelRecord(cup);
    expect([r.w, r.l, r.h]).toEqual([1, 1, 1]);
    expect(r.holes.a).toBe(5);
    expect(cupScore(cup).a).toBe(1.5);
  });
  it('projects live matches (all square splits the point)', () => {
    const cup = duel({ matches: [m(9, ['a', 'a']), m(9, ['half'])] });
    expect(cupLive(cup)).toMatchObject({ a: 1.5, b: 0.5, live: 2 });
  });
});

describe('handicap strokes', () => {
  const cup = duel({ net: true, hcp: { a: 8, b: 14 } });
  const sum = (v: number[]) => v.reduce((t, x) => t + x, 0);
  it('gives the full difference on the hardest holes over 18', () => {
    const full = buildMatches(cup, 'r', 'singles', 18, 1, 18).matches[0];
    const st = matchStrokes(cup, full);
    expect(sum(st.players.b)).toBe(6);
    expect(sum(st.players.a)).toBe(0);
    // Default stroke index: SI 1–6 are holes 5, 14, 3, 12, 9, 18.
    expect([5, 14, 3, 12, 9, 18].every((h) => st.players.b[h - 1] === 1)).toBe(true);
  });
  it('scales strokes to shorter matches', () => {
    const nines = buildMatches(cup, 'r', 'singles', 18, 1, 9).matches.map((x) => sum(matchStrokes(cup, x).players.b));
    const sixes = buildMatches(cup, 'r', 'singles', 18, 1, 6).matches.map((x) => sum(matchStrokes(cup, x).players.b));
    expect(nines).toEqual([3, 3]);
    expect(sixes).toEqual([2, 2, 2]);
  });
  it('follows a course stroke index when one is entered', () => {
    const si = [1, 3, 5, 7, 9, 11, 13, 15, 17, 2, 4, 6, 8, 10, 12, 14, 16, 18];
    const c = { ...cup, si: { r: si } };
    const st = matchStrokes(c, buildMatches(c, 'r', 'singles', 18, 1, 18).matches[0]);
    expect(st.players.b.slice(0, 3)).toEqual([1, 1, 1]);
  });
  it('gives no strokes when handicaps are off', () => {
    const st = matchStrokes({ ...cup, net: false }, buildMatches(cup, 'r', 'singles', 18, 1, 18).matches[0]);
    expect(Object.keys(st.players)).toHaveLength(0);
  });
  it('uses team allowances for alternate shot and scramble', () => {
    const four = { ...duel(), duel: false, net: true, hcp: { a: 2, c: 20, b: 10, d: 12 },
      teams: [{ name: 'A', captain: 'a', members: ['a', 'c'] }, { name: 'B', captain: 'b', members: ['b', 'd'] }] } as typeof cup;
    const mk = (format: CupMatch['format']): CupMatch => ({ id: 'q', round: 'r', format, holes: 18, a: ['a', 'c'], b: ['b', 'd'] });
    expect(sum(matchStrokes(four, mk('alt')).sides.a) + sum(matchStrokes(four, mk('alt')).sides.b)).toBe(0); // 11 vs 11
    expect(sum(matchStrokes(four, mk('scramble')).sides.b)).toBe(2); // 3.7 vs 5.3
    const bb = matchStrokes(four, mk('bestball')).players; // 90% off the lowest (2)
    expect([sum(bb.a), sum(bb.c), sum(bb.b), sum(bb.d)]).toEqual([0, 16, 7, 9]);
  });
});
