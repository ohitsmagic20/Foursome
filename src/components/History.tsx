'use client';

import { useEffect, useState } from 'react';
import { api, firstName } from '@/lib/client';
import type { GolfTotals, TripGolf } from '@/lib/shared';
import { useTrip } from './ui';

export interface TripHistory {
  people: Record<string, { hcp: number | null; hcpFrom: string | null; trips: number; w: number; l: number; h: number; won: number; lost: number }>;
  h2h: { a: string; b: string; w: number; l: number; h: number }[];
}

const cache = new Map<string, Promise<TripHistory | null>>();

/** Golf on earlier trips for the signed-in people on this one. Null until it loads, or if nobody has any. */
export function useTripHistory(): TripHistory | null {
  const { state } = useTrip();
  const code = state.trip.code;
  const [h, setH] = useState<TripHistory | null>(null);
  useEffect(() => {
    let live = true;
    if (!cache.has(code)) cache.set(code, api<TripHistory>(`/api/trips/${code}/history`, { code }).catch(() => null));
    cache.get(code)!.then((r) => { if (live) setH(r); });
    return () => { live = false; };
  }, [code]);
  return h;
}

const rec = (w: number, l: number, h: number) => `${w}–${l}${h ? `–${h}` : ''}`;

/** On a two-person match play: how these two have done against each other on earlier trips. */
export function HeadToHead() {
  const { state, me } = useTrip();
  const hist = useTripHistory();
  const cup = state.trip.cup;
  if (!cup?.duel || !hist) return null;
  const [x, y] = [cup.teams[0].members[0], cup.teams[1].members[0]];
  const row = hist.h2h.find((r) => (r.a === x && r.b === y) || (r.a === y && r.b === x));
  if (!row) return null;
  const flip = row.a !== x;
  const [w, l] = flip ? [row.l, row.w] : [row.w, row.l];
  const nm = (id: string) => (id === me?.id ? 'You' : firstName(state.members.find((m) => m.id === id)?.name || '?'));
  return (
    <p className="h2h">
      <b>Before this trip:</b> {nm(x)} {rec(w, l, row.h)} {nm(y) === 'You' ? 'you' : nm(y)}
      {w !== l && <> · {w > l ? nm(x) : nm(y)} {w > l ? (nm(x) === 'You' ? 'lead' : 'leads') : (nm(y) === 'You' ? 'lead' : 'leads')} the series</>}
    </p>
  );
}

/** For the profile page: every trip's golf, with lifetime totals. */
export function YourGolf() {
  const [data, setData] = useState<{ trips: TripGolf[]; totals: GolfTotals } | null>(null);
  useEffect(() => { api<{ trips: TripGolf[]; totals: GolfTotals }>('/api/me/golf').then(setData).catch(() => setData(null)); }, []);
  if (!data || !data.trips.length) return null;
  const t = data.totals;
  const holes = t.won + t.lost + t.halved;
  const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}$${Math.abs(Math.round(n))}`;
  return (
    <section className="section">
      <h2>Your golf</h2>
      <div className="card golf-totals">
        <div><span className="k">Matches</span><b>{rec(t.w, t.l, t.h)}</b></div>
        <div><span className="k">Holes won</span><b>{holes ? `${Math.round((t.won / holes) * 100)}%` : '—'}</b></div>
        <div><span className="k">Side games</span><b>{signed(t.games)}</b></div>
      </div>
      <div className="list">
        {data.trips.map((x) => {
          const r = x.matches.reduce((a, m) => ({ ...a, [m.res]: a[m.res] + 1 }), { w: 0, l: 0, h: 0 });
          return (
            <a key={x.code} className="row" href={`/t/${x.code}#cup`} style={{ color: 'inherit', textDecoration: 'none' }}>
              <div className="grow">
                <div className="row-title">{x.name}</div>
                <div className="row-meta">
                  {[x.start ? new Date(x.start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '',
                    x.matches.length ? `${rec(r.w, r.l, r.h)} in matches` : '',
                    x.games ? `${signed(x.games)} side games` : '',
                    x.hcp !== null ? `played off ${x.hcp}` : ''].filter(Boolean).join(' · ')}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
