import { describe, expect, it } from 'vitest';
import { applyGameScore, gameNet, settleUp, skinsTable, withQueuedScores, type SideGame } from '@/lib/shared';
import { trip } from './fixtures';

const four = ['m1', 'm2', 'm3', 'm4'];
const skins = (extra: Partial<SideGame> = {}): SideGame => ({ id: 'g', kind: 'skins', round: null, stake: 5, players: four, by: 'm1', holes: 18, carry: true, skins: [], ...extra });
const net = (g: SideGame) => Object.fromEntries([...gameNet(g)].map(([k, v]) => [k, v / 100]));

describe('side games', () => {
  it('skins: the winner collects the stake from every other player', () => {
    expect(net(skins({ skins: ['m2'] }))).toEqual({ m1: -5, m2: 15, m3: -5, m4: -5 });
  });
  it('skins: ties carry, and the next outright winner takes them all', () => {
    const g = skins({ skins: ['tie', 'tie', 'm3'] });
    expect(skinsTable(g).won).toEqual([{ hole: 3, who: 'm3', worth: 3 }]);
    expect(net(g)).toEqual({ m1: -15, m2: -15, m3: 45, m4: -15 });
    expect(skinsTable(skins({ skins: ['m1', 'tie'] })).carrying).toBe(1);
    expect(net(skins({ carry: false, skins: ['tie', 'm3'] })).m3).toBe(15);
  });
  it('closest to the pin and long drive pay per prize', () => {
    const g: SideGame = { id: 'c', kind: 'ctp', round: null, stake: 10, players: four, by: 'm1', prizes: [{ label: 'Hole 3', winner: 'm1' }, { label: 'Hole 7', winner: 'm1' }, { label: 'Hole 12', winner: null }] };
    expect(net(g)).toEqual({ m1: 60, m2: -20, m3: -20, m4: -20 });
  });
  it('nassau: the losing side pays each bet; a push moves nothing', () => {
    const g: SideGame = { id: 'n', kind: 'nassau', round: null, stake: 10, players: four, by: 'm1', sides: [['m1', 'm2'], ['m3', 'm4']], nassau: { front: 'a', back: 'half', total: 'a' } };
    expect(net(g)).toEqual({ m1: 20, m2: 20, m3: -20, m4: -20 });
  });
  it('winnings flow into settle up', () => {
    const s = trip(4, [], { games: { v: 1, list: [skins({ skins: ['m2'] })] } });
    const r = settleUp(s);
    expect(r.payments.reduce((t, p) => t + p.amount, 0)).toBe(15);
    expect(r.payments.every((p) => p.to === 'm2')).toBe(true);
    expect(r.games.get('m2')).toBe(15);
  });
  it('applies a tap, and taps waiting for signal show up', () => {
    const g = skins();
    applyGameScore(g, { op: 'skin', hole: 2, winner: 'm4' });
    expect(g.skins?.[1]).toBe('m4');
    applyGameScore(g, { op: 'skin', hole: 2, winner: 'stranger' });
    expect(g.skins?.[1]).toBeNull();
    const s = trip(4, [], { games: { v: 1, list: [skins()] } });
    const shown = withQueuedScores(s, [{ body: { type: 'game', op: 'skin', id: 'g', hole: 1, winner: 'm1' } }]);
    expect(shown.trip.games!.list[0].skins?.[0]).toBe('m1');
    expect(s.trip.games!.list[0].skins).toEqual([]);
  });
});
