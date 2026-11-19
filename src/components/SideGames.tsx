'use client';

import { useState } from 'react';
import type { CupResult, DateData, GameKind, SideGame, TripState } from '@/lib/shared';
import { GAME_NAMES, NASSAU_BETS, dayLabel, gameNet, pickOf, plannedRounds, skinsTable } from '@/lib/shared';
import { firstName, initials } from '@/lib/client';
import { ConfirmButton, Icon, MoreMenu, useTrip, type TripCtx } from './ui';

const dollars = (c: number) => {
  const v = Math.abs(c) / 100;
  return `${c > 0 ? '+' : c < 0 ? '−' : ''}$${Number.isInteger(v) ? v : v.toFixed(2)}`;
};
const stakeText = (g: SideGame) => {
  const s = `$${Number.isInteger(g.stake) ? g.stake : g.stake.toFixed(2)}`;
  return g.kind === 'skins' ? `${s} a skin${g.carry ? ', ties carry' : ''}`
    : g.kind === 'nassau' ? `${s} front, back and overall`
    : `${s} a prize`;
};
const roundLabel = (state: TripState, id: string | null) => {
  if (!id) return 'Whole trip';
  const r = plannedRounds(state).find((x) => x.id === id) || state.options.find((x) => x.id === id);
  if (!r) return 'A round that was removed';
  const start = pickOf<DateData>(state, 'date').option?.data.start;
  const d = r.data as { course?: string; day?: number };
  return `${start && d.day ? dayLabel(start, d.day).split(',')[0] + ' · ' : ''}${d.course || 'Round'}`;
};

/** In the Cup tab: skins, closest to the pin, long drive and Nassau bets. Winnings go into Settle up. */
export function SideGames() {
  const ctx = useTrip();
  const { state, me } = ctx;
  if (!me) return null;
  if (state.trip.games === undefined) {
    return me.is_organizer ? (
      <section className="section">
        <div className="section-head"><h2>Side games</h2></div>
        <div className="card empty">Side games need a one-time database update. Run supabase/010_games.sql in the Supabase SQL Editor, then come back.</div>
      </section>
    ) : null;
  }
  const list = state.trip.games?.list || [];
  // Your running total across every game.
  const mine = list.reduce((s, g) => s + (gameNet(g).get(me.id) || 0), 0);
  return (
    <section className="section">
      <div className="section-head">
        <h2>Side games</h2>
        {list.length > 0 && <span className="sub">{mine ? `You’re ${dollars(mine)}` : 'You’re even'}</span>}
      </div>
      {list.length === 0 ? (
        <button className="card empty dashed" onClick={() => gameSheet(ctx)}>
          Skins, closest to the pin, long drive or a Nassau. Enter winners as you play; the money goes straight into Settle up.
        </button>
      ) : (
        <div className="games">
          {list.map((g) => <GameCard key={g.id} g={g} />)}
          <button className="btn block" onClick={() => gameSheet(ctx)}>{Icon.plus} Add a side game</button>
        </div>
      )}
    </section>
  );
}

function GameCard({ g }: { g: SideGame }) {
  const ctx = useTrip();
  const { state, me, act, toast } = ctx;
  const [open, setOpen] = useState(false);
  const nm = (id: string) => (id === me?.id ? 'You' : firstName(state.members.find((m) => m.id === id)?.name || '?'));
  const net = gameNet(g);
  const board = [...net].filter(([, c]) => c).sort((a, b) => b[1] - a[1]);
  const canEdit = !!me && (me.is_organizer || g.by === me.id);
  const progress = g.kind === 'skins'
    ? (() => { const t = skinsTable(g); const played = (g.skins || []).filter(Boolean).length; return `${played} of ${g.holes || 18} holes${t.carrying ? ` · ${t.carrying + 1} skins riding on the next hole` : ''}`; })()
    : g.kind === 'nassau' ? `${NASSAU_BETS.filter((b) => g.nassau?.[b.k]).length} of 3 bets settled`
    : `${(g.prizes || []).filter((p) => p.winner).length} of ${(g.prizes || []).length} prize${(g.prizes || []).length === 1 ? '' : 's'} won`;
  return (
    <div className="card game">
      <div className="game-head">
        <button type="button" className="game-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span className="row-title">{GAME_NAMES[g.kind]} <span className="game-stake">{stakeText(g)}</span></span>
          <span className="row-meta">{roundLabel(state, g.round)} · {progress}</span>
          <span className="game-board">
            {board.length ? board.map(([id, c]) => <span key={id} className={c > 0 ? 'up' : 'down'}>{nm(id)} {dollars(c)}</span>) : <span className="row-meta">No money moved yet</span>}
          </span>
        </button>
        {canEdit && <MoreMenu items={[
          { label: 'Edit game', onClick: () => gameSheet(ctx, g) },
          { label: 'Delete game', danger: true, onClick: async () => { if (confirm(`Delete this ${GAME_NAMES[g.kind].toLowerCase()} game and its results?`) && await act('game', { op: 'delete', id: g.id })) toast('Game deleted'); } },
        ]} />}
      </div>
      {open && (
        <div className="game-body">
          {g.kind === 'skins' && <SkinsCard g={g} nm={nm} />}
          {(g.kind === 'ctp' || g.kind === 'long') && <PrizesCard g={g} nm={nm} />}
          {g.kind === 'nassau' && <NassauCard g={g} nm={nm} />}
        </div>
      )}
      {!open && <button type="button" className="link-btn game-open" onClick={() => setOpen(true)}>Enter results</button>}
    </div>
  );
}

function SkinsCard({ g, nm }: { g: SideGame; nm: (id: string) => string }) {
  const { act } = useTrip();
  const n = g.holes || 18;
  const skins = Array.from({ length: n }, (_, i) => g.skins?.[i] ?? null);
  const firstOpen = skins.findIndex((s) => !s);
  const [sel, setSel] = useState<number>(firstOpen < 0 ? n - 1 : firstOpen);
  const t = skinsTable(g);
  const worth = (i: number) => {
    // What hole i is worth if someone wins it outright now: 1 plus the ties carried into it.
    if (!g.carry) return 1;
    let c = 0;
    for (let k = i - 1; k >= 0 && skins[k] === 'tie'; k--) c++;
    return 1 + c;
  };
  const set = (w: string | null) => {
    const i = sel;
    act('game', { op: 'skin', id: g.id, hole: i + 1, winner: w });
    if (w) { const next = skins.findIndex((s, k) => k > i && !s); if (next >= 0) setSel(next); }
  };
  return (
    <>
      <div className={`sc-grid h${n === 9 ? 9 : 18}`}>
        {skins.map((s, i) => {
          const won = t.won.find((x) => x.hole === i + 1);
          return (
            <button key={i} type="button" className={`sc-cell skin-cell${s === 'tie' ? ' tie' : s ? ' won' : ''}`} aria-pressed={sel === i} onClick={() => setSel(i)} aria-label={`Hole ${i + 1}${s === 'tie' ? ', tied' : s ? `, ${nm(s)}` : ''}`}>
              <span>{i + 1}</span>
              <b>{s === 'tie' ? '=' : s ? initials(nm(s)) : ''}{won && won.worth > 1 && <i className="skin-x">×{won.worth}</i>}</b>
            </button>
          );
        })}
      </div>
      <div className="skin-pick">
        <div className="row-meta">Hole {sel + 1}{worth(sel) > 1 ? ` · worth ${worth(sel)} skins` : ''}: who won it?</div>
        <div className="pick-row">
          {g.players.map((id) => <button key={id} type="button" className={`btn small${skins[sel] === id ? ' primary' : ''}`} onClick={() => set(skins[sel] === id ? null : id)}>{nm(id)}</button>)}
          <button type="button" className={`btn small ghost${skins[sel] === 'tie' ? ' on' : ''}`} onClick={() => set(skins[sel] === 'tie' ? null : 'tie')}>{g.carry ? 'Tie, carry it' : 'Tie'}</button>
        </div>
        {skins[sel] && <button type="button" className="link-btn" onClick={() => set(null)}>Clear hole {sel + 1}</button>}
      </div>
    </>
  );
}

function PrizesCard({ g, nm }: { g: SideGame; nm: (id: string) => string }) {
  const { act } = useTrip();
  return (
    <div className="prize-list">
      {(g.prizes || []).map((p, i) => (
        <div key={i} className="prize">
          <span className="row-title">{p.label}</span>
          <select aria-label={`${p.label} winner`} value={p.winner || ''} onChange={(e) => act('game', { op: 'prize', id: g.id, index: i, winner: e.target.value || null })}>
            <option value="">Nobody yet</option>
            {g.players.map((id) => <option key={id} value={id}>{nm(id)}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

function NassauCard({ g, nm }: { g: SideGame; nm: (id: string) => string }) {
  const { act } = useTrip();
  const [a, b] = g.sides || [[], []];
  const sa = a.map(nm).join(' & '), sb = b.map(nm).join(' & ');
  const set = (bet: string, r: CupResult | null) => act('game', { op: 'bet', id: g.id, bet, result: r });
  return (
    <div className="prize-list">
      {NASSAU_BETS.map(({ k, label }) => {
        const r = g.nassau?.[k] ?? null;
        return (
          <div key={k} className="prize nassau">
            <span className="row-title">{label}</span>
            <div className="seg seg-result" role="group" aria-label={label}>
              <button type="button" aria-pressed={r === 'a'} onClick={() => set(k, r === 'a' ? null : 'a')}>{sa}</button>
              <button type="button" aria-pressed={r === 'half'} onClick={() => set(k, r === 'half' ? null : 'half')}>Push</button>
              <button type="button" aria-pressed={r === 'b'} onClick={() => set(k, r === 'b' ? null : 'b')}>{sb}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- add / edit ---------- */

function defaults(state: TripState, meId: string | undefined, kind: GameKind, round: string | null) {
  const ids = state.members.map((m) => m.id);
  const r = plannedRounds(state).find((x) => x.id === round);
  // Skins and prizes: your tee-time group if the round has them, else everyone.
  const group = r?.data.groups?.find((gr) => meId && gr.includes(meId));
  // Closest to the pin and long drive are often the whole group; skins and Nassau are usually one foursome.
  const four = meId ? [meId, ...ids.filter((x) => x !== meId)].slice(0, 4) : ids.slice(0, 4);
  const players = group?.length ? group : kind === 'ctp' || kind === 'long' ? ids : four;
  const cup = state.trip.cup;
  const sides: [string[], string[]] = cup?.duel ? [cup.teams[0].members, cup.teams[1].members]
    : players.length === 2 ? [[players[0]], [players[1]]]
    : [players.slice(0, Math.ceil(players.length / 2)), players.slice(Math.ceil(players.length / 2))];
  return { players, sides, prizes: kind === 'ctp' ? 'Par 3s' : 'Longest drive' };
}

function GameForm({ ctx, g }: { ctx: TripCtx; g?: SideGame }) {
  const { state, me } = ctx;
  const rounds = plannedRounds(state);
  const [kind, setKind] = useState<GameKind>(g?.kind || 'skins');
  const [round, setRound] = useState<string>(g ? g.round || '' : rounds[0]?.id || '');
  const d = defaults(state, me?.id, kind, round || null);
  const [stake, setStake] = useState(g ? String(g.stake) : '5');
  const [players, setPlayers] = useState<string[]>(g?.players || d.players);
  const [sides, setSides] = useState<[string[], string[]]>(g?.sides || d.sides);
  const pickKind = (k: GameKind) => {
    setKind(k);
    if (g) return;
    setPrizeCount(k === 'ctp' ? 4 : 1);
    const nd = defaults(state, me?.id, k, round || null);
    setPlayers(nd.players); setSides(nd.sides);
  };
  const [holes, setHoles] = useState(g?.holes || 18);
  const [carry, setCarry] = useState(g ? g.carry !== false : true);
  const [prizeCount, setPrizeCount] = useState(g?.prizes?.length || (kind === 'ctp' ? 4 : 1));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const nm = (id: string) => (id === me?.id ? 'Me' : firstName(state.members.find((m) => m.id === id)?.name || '?'));
  const prizeLabels = (k: GameKind, n: number) => Array.from({ length: n }, (_, i) => g?.kind === k && g.prizes?.[i]?.label ? g.prizes[i].label : n === 1 ? (k === 'ctp' ? 'Closest to the pin' : 'Longest drive') : `${k === 'ctp' ? 'Par 3' : 'Drive'} ${i + 1}`);
  const side = (id: string) => (sides[0].includes(id) ? 0 : sides[1].includes(id) ? 1 : -1);
  const setSide = (id: string, s: number) => {
    const a = sides[0].filter((x) => x !== id), b = sides[1].filter((x) => x !== id);
    if (s === 0) a.push(id); if (s === 1) b.push(id);
    setSides([a, b]);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const ok = await ctx.act('game', { op: 'save', id: g?.id, kind, round, stake: Number(stake), players, sides, holes, carry, prizes: prizeLabels(kind, prizeCount) });
    setBusy(false);
    if (ok) { ctx.sheet(null); ctx.toast(g ? 'Game updated' : `${GAME_NAMES[kind]} is on`); }
  };
  const help: Record<GameKind, string> = {
    skins: 'Win a hole outright and every other player pays you the stake. With carryovers, a tied hole adds its skin to the next one.',
    ctp: 'Each prize is one hole, usually the par 3s. The winner gets the stake from every other player.',
    long: 'Each prize is one hole’s longest drive in the fairway. The winner gets the stake from every other player.',
    nassau: 'Three bets between two sides: front 9, back 9 and overall. The losing side pays the stake on each one they lose.',
  };
  return (
    <form className="form" onSubmit={submit}>
      <div className="seg game-kinds" role="group" aria-label="Game">
        {(['skins', 'ctp', 'long', 'nassau'] as GameKind[]).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => pickKind(k)}>{k === 'ctp' ? 'Closest' : k === 'long' ? 'Long drive' : GAME_NAMES[k]}</button>
        ))}
      </div>
      <p className="hint" style={{ marginTop: -4 }}>{help[kind]}</p>
      <div className="field">
          <label htmlFor="g-round">Round</label>
          <select id="g-round" value={round} onChange={(e) => { setRound(e.target.value); if (!g) { const nd = defaults(state, me?.id, kind, e.target.value || null); setPlayers(nd.players); setSides(nd.sides); } }}>
            {rounds.map((r) => <option key={r.id} value={r.id}>{roundLabel(state, r.id)}</option>)}
            <option value="">Whole trip</option>
          </select>
      </div>
      <div className="grid2">
        <div className="field">
          <label htmlFor="g-stake">{kind === 'skins' ? 'Per skin ($)' : kind === 'nassau' ? 'Per bet ($)' : 'Per prize ($)'}</label>
          <input id="g-stake" type="number" inputMode="decimal" min={0.25} step="0.25" required value={stake} onChange={(e) => setStake(e.target.value)} />
        </div>
        {kind === 'skins' && (
          <div className="field">
            <label>Holes</label>
            <div className="seg">{[18, 9].map((h) => <button key={h} type="button" aria-pressed={holes === h} onClick={() => setHoles(h)}>{h}</button>)}</div>
          </div>
        )}
        {(kind === 'ctp' || kind === 'long') && (
          <div className="field">
            <label>Prizes</label>
            <div className="seg">{[1, 2, 3, 4].map((c) => <button key={c} type="button" aria-pressed={prizeCount === c} onClick={() => setPrizeCount(c)}>{c}</button>)}</div>
          </div>
        )}
      </div>
      {kind === 'skins' && (
          <div className="field">
            <label>Tied hole</label>
            <div className="seg"><button type="button" aria-pressed={carry} onClick={() => setCarry(true)}>Carry to the next hole</button><button type="button" aria-pressed={!carry} onClick={() => setCarry(false)}>Nobody wins it</button></div>
          </div>
      )}
      {kind === 'nassau' ? (
        <div className="field">
          <label>Sides</label>
          <div className="side-list">
            {state.members.map((m) => (
              <div key={m.id} className="side-row">
                <span>{nm(m.id)}</span>
                <div className="seg seg-small" role="group" aria-label={`${nm(m.id)}’s side`}>
                  <button type="button" aria-pressed={side(m.id) === 0} onClick={() => setSide(m.id, 0)}>Side A</button>
                  <button type="button" aria-pressed={side(m.id) === -1} onClick={() => setSide(m.id, -1)}>Out</button>
                  <button type="button" aria-pressed={side(m.id) === 1} onClick={() => setSide(m.id, 1)}>Side B</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="field">
          <label>Who’s in</label>
          <div className="split-list">
            {state.members.map((m) => (
              <label key={m.id} className="split-item">
                <input type="checkbox" checked={players.includes(m.id)} onChange={(e) => setPlayers(e.target.checked ? [...players, m.id] : players.filter((x) => x !== m.id))} />
                {nm(m.id)}
              </label>
            ))}
          </div>
        </div>
      )}
      {err && <p className="error">{err}</p>}
      <div className="btn-row" style={{ marginTop: 4 }}>
        <button className="btn primary" style={{ flex: 1 }} disabled={busy}>{busy ? <span className="spinner" /> : g ? 'Save' : 'Start the game'}</button>
        {g && <ConfirmButton label="Delete" onConfirm={async () => { if (await ctx.act('game', { op: 'delete', id: g.id })) { ctx.sheet(null); ctx.toast('Game deleted'); } }} />}
      </div>
    </form>
  );
}

export function gameSheet(ctx: TripCtx, g?: SideGame) {
  ctx.sheet({ title: g ? `Edit ${GAME_NAMES[g.kind].toLowerCase()}` : 'Add a side game', body: <GameForm ctx={ctx} g={g} /> });
}
