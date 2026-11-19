import { describe, expect, it } from 'vitest';
import { withQueuedScores, type CupMatch } from '@/lib/shared';
import { queueKey } from '@/lib/outbox';
import { duel, trip } from './fixtures';

const match = (extra: Partial<CupMatch> = {}): CupMatch => ({ id: 'x', round: 'r', format: 'singles', a: ['a'], b: ['b'], holes: 9, play: [], result: null, ...extra } as CupMatch);
const hole = (h: number, winner: string | null) => ({ body: { type: 'cup', op: 'hole', match: 'x', hole: h, winner } });

describe('scores with no signal', () => {
  it('only score taps wait for signal', () => {
    expect(queueKey('cup', { op: 'hole', match: 'x', hole: 3 })).toBe('hole:x:3');
    expect(queueKey('cup', { op: 'result', match: 'x' })).toBe('result:x');
    expect(queueKey('cup', { op: 'setup' })).toBeNull();
    expect(queueKey('vote', {})).toBeNull();
  });

  it('shows queued taps on top of the saved card, and closes out a decided match', () => {
    const s = trip(2, [], { cup: duel({ matches: [match({ holes: 6, play: ['a', 'a', 'a'] })] }) });
    const shown = withQueuedScores(s, [hole(4, 'a')]);
    const m = shown.trip.cup!.matches[0];
    expect(m.play?.slice(0, 4)).toEqual(['a', 'a', 'a', 'a']);
    expect(m.result).toBe('a');              // 4 up with 2 to play
    expect(s.trip.cup!.matches[0].play).toEqual(['a', 'a', 'a']); // the saved state isn't touched
  });

  it('a queued clear wipes the card, and later taps start it again', () => {
    const s = trip(2, [], { cup: duel({ matches: [match({ play: ['a', 'b'] })] }) });
    const shown = withQueuedScores(s, [{ body: { op: 'clear_match', match: 'x' } }, hole(1, 'half')]);
    expect(shown.trip.cup!.matches[0].play?.slice(0, 2)).toEqual(['half', null]);
  });
});
