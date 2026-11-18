'use client';

import { useEffect, useRef, useState } from 'react';
import type { Cup as CupT, CupFormat, CupMatch, CupResult, Option, RoundData } from '@/lib/shared';
import { CUP_FORMATS, DEFAULT_SI, HCP_RULE, matchStrokes, marginsFor, segLabel, duelRecord, andList, cupLive, cupPlayerPoints, cupScore, dayLabel, draftTurn, matchStatus, pickOf, plannedRounds, pts, statusLabel, teeMinutes } from '@/lib/shared';
import type { HoleWin } from '@/lib/shared';
import type { DateData } from '@/lib/shared';
import { firstName, initials } from '@/lib/client';
import { Icon, useTrip, type TripCtx } from './ui';

const TEAM_CLASS = ['team-a', 'team-b'] as const;

/** Team match play for the trip, Internet Invitational style: captains, a draft, a point a match. */
/** Whether the trip shows a Cup tab: once there's a cup, a group big enough for one (4+), or two people for match play. */
export function hasCupTab(state: TripCtx['state']): boolean {
  return !!state.trip.cup || state.members.length >= 4 || state.members.length === 2;
}

/** The Cup tab: set-up for the organizer, the draft, then the scoreboard and matches. */
export function CupTab() {
  const { state, me } = useTrip();
  const n = state.members.length;
  const cup = 'cup' in state.trip ? state.trip.cup : undefined;
  const duel = cup ? !!cup.duel : n === 2;
  const score = cup ? cupScore(cup) : null;
  const rec = cup?.duel ? duelRecord(cup) : null;
  const live = cup ? cupLive(cup) : null;
  void score; void rec;
  // The banner: the competition at a glance, in the trophy colors.
  const line = !cup ? (n === 2 ? 'One on one, every match on the record' : n >= 4 ? 'Two teams, match play, a point a match' : 'Needs 2 players for match play, or 4+ for a team cup')
    : rec ? `${cup.teams[0].name} ${rec.w}–${rec.l}${rec.h ? `–${rec.h}` : ''} ${cup.teams[1].name}`
    : cup.drafting ? 'The draft is on'
    : `${cup.teams[0].name} ${pts(score!.a)} · ${pts(score!.b)} ${cup.teams[1].name}`;
  return (
    <>
      <div className="cup-hero">
        <span className="cup-hero-icon" aria-hidden="true">{Icon.cup}</span>
        <div style={{ minWidth: 0 }}>
          <div className="cup-hero-eyebrow">{duel ? 'Match play' : 'The Cup'}</div>
          <h1 className="cup-hero-title">{cup ? cup.name : 'Preview'}</h1>
          {/* The scoreboard below has the score; the banner only pitches it before there's a cup. */}
          {!cup && <div className="cup-hero-line">{line}</div>}
          {cup && live && live.live > 0 && <div className="cup-hero-line"><span className="live-dot" /> {live.live} match{live.live === 1 ? '' : 'es'} on the course</div>}
        </div>
      </div>
      {cup === undefined ? (
        <div className="card empty">{me?.is_organizer
          ? 'The Cup needs a one-time database update before it can save teams and results. Run supabase/008_cup.sql in the Supabase SQL Editor, then come back.'
          : 'The Cup isn’t switched on for this trip yet.'}</div>
      ) : cup ? <CupSection /> : <section className="section"><div className="card"><CupPreview /></div></section>}
    </>
  );
}

/** On the Golf tab: a one-line score that opens the Cup tab. */
export function CupLink() {
  const { state, go } = useTrip();
  const cup = state.trip.cup;
  if (!cup) return null;
  const score = cupScore(cup);
  const live = cupLive(cup);
  return (
    <button className="card cup-link" onClick={() => go('cup')}>
      <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
        <span className="eyebrow" style={{ display: 'block' }}>{cup.name}{live.live > 0 ? ` · ${live.live} live · projected ${pts(live.a)}–${pts(live.b)}` : ''}</span>
        <span className="row-title">{cup.drafting ? 'The draft is on' : `${cup.teams[0].name} ${pts(score.a)} · ${pts(score.b)} ${cup.teams[1].name}`}</span>
      </span>
      {Icon.chev}
    </button>
  );
}

/**
 * On the Golf tab: the cup folded into one line, opening to the whole thing in place.
 * With no cup yet, it opens to a preview built from whoever has joined so far, with open spots for the rest.
 */
export function CupDropdown() {
  const ctx = useTrip();
  const { state } = ctx;
  const ref = useRef<HTMLDetailsElement>(null);
  // Links to the cup (#cup, notifications) open it here and scroll to it.
  useEffect(() => {
    const show = () => { if (!ref.current) return; ref.current.open = true; ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    if (window.location.hash === '#cup') setTimeout(show, 150);
    window.addEventListener('foresome:cup', show);
    return () => window.removeEventListener('foresome:cup', show);
  }, []);
  if (!('cup' in state.trip)) return null;
  const cup = state.trip.cup;
  const score = cup ? cupScore(cup) : null;
  const live = cup ? cupLive(cup) : null;
  const rec = cup?.duel ? duelRecord(cup) : null;
  const line = !cup ? 'Not set up yet · see a preview'
    : rec ? `${cup.teams[0].name} ${rec.w}–${rec.l}${rec.h ? `–${rec.h}` : ''} ${cup.teams[1].name}${live!.live ? ` · ${live!.live} live` : ''}`
    : cup.drafting ? 'The draft is on'
    : `${cup.teams[0].name} ${pts(score!.a)} · ${pts(score!.b)} ${cup.teams[1].name}${live!.live ? ` · ${live!.live} live` : ''}`;
  return (
    <details className="card cup-drop" id="cup" ref={ref}>
      <summary>
        <span className="cup-drop-icon" aria-hidden="true">{Icon.cup}</span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="eyebrow" style={{ display: 'block' }}>{cup ? (cup.duel ? `Match play · ${cup.name}` : cup.name) : state.members.length === 2 ? 'Match play' : 'The Cup'}</span>
          <span className="row-title">{line}</span>
        </span>
      </summary>
      <div className="cup-drop-body">
        {cup ? <CupSection /> : <CupPreview />}
      </div>
    </details>
  );
}

/** What the cup would look like with the people on the trip now: two even teams, open spots, a match count per round. */
function CupPreview() {
  const ctx = useTrip();
  const { state, me } = ctx;
  const n = state.members.length;
  if (n === 2) return <DuelPreview />;
  // Fill out to foursomes: an even number of players, in groups of four.
  const seats = Math.max(4, Math.ceil(n / 4) * 4);
  const perTeam = seats / 2;
  const open = seats - n;
  const name = (id: string) => (id === me?.id ? 'You' : firstName(state.members.find((m) => m.id === id)?.name || ''));
  // Alternate players onto two sides just for the picture; the real teams come from the draft.
  const sides: (string | null)[][] = [[], []];
  state.members.forEach((m, i) => sides[i % 2].push(m.id));
  for (const s of sides) while (s.length < perTeam) s.push(null);
  // The place being looked at on the Golf tab (so the preview matches the rounds on screen).
  const rounds = plannedRounds(state, ctx.place).slice().sort((a, b) => a.data.day - b.data.day || teeMinutes(a.data.time) - teeMinutes(b.data.time));
  const date = pickOf<DateData>(state, 'date').option?.data.start;
  const fmts: CupFormat[] = ['scramble', 'bestball', 'alt', 'singles'];
  const plan = rounds.map((r, i) => {
    const f = rounds.length > 1 && i === rounds.length - 1 ? 'singles' : fmts[i % 3];
    return { r, f, matches: Math.floor(perTeam / CUP_FORMATS[f].per) };
  });
  const total = plan.reduce((t, p) => t + p.matches, 0);
  return (
    <div className="cup-preview">
      <p className="sub">A preview with the {n} {n === 1 ? 'person' : 'people'} on the trip{open ? ` and ${open} open spot${open === 1 ? '' : 's'} to fill out ${seats / 4} foursome${seats > 4 ? 's' : ''}` : ''}. Teams here are just a sketch: the captains draft the real ones.</p>
      <div className="cup-rosters">
        {sides.map((t, i) => (
          <div key={i} className={`cup-roster ${TEAM_CLASS[i]}`}>
            <div className="cup-team-name">Team {i + 1}</div>
            {t.map((id, k) => <div key={k} className={`row-meta${id ? '' : ' open-spot'}`}>{id ? name(id) : 'Open spot'}</div>)}
          </div>
        ))}
      </div>
      {plan.length > 0 ? (
        <div className="cup-preview-rounds">
          {plan.map(({ r, f, matches }) => (
            <div className="row" key={r.id}>
              <div className="grow">
                <div className="row-title">{date ? dayLabel(date, r.data.day) : `Day ${r.data.day}`} · {r.data.course}</div>
                <div className="row-meta">{CUP_FORMATS[f].label} · {matches} match{matches === 1 ? '' : 'es'} ({CUP_FORMATS[f].per === 1 ? '1 v 1' : '2 v 2'})</div>
              </div>
              <span className="chip plain">{matches} pt{matches === 1 ? '' : 's'}</span>
            </div>
          ))}
          <div className="cup-preview-total"><span>{total} points to play</span><b>{pts(total / 2 + 0.5)} to win</b></div>
        </div>
      ) : <p className="hint">Add rounds to the plan and each one shows up here with its matches.</p>}
      <p className="hint">Formats are a suggestion; the organizer picks one per round. Each match is a point, and a halved match is half a point each.</p>
      {me?.is_organizer && n >= 4 && <button className="btn primary" onClick={() => setupSheet(ctx)}>Set up the cup</button>}
      {me?.is_organizer && n < 4 && <p className="hint">You can set it up once at least 4 people have joined.</p>}
    </div>
  );
}

/** Match play for two: who plays whom, and how many matches the planned rounds make at 18, 9 or 6 holes each. */
function DuelPreview() {
  const ctx = useTrip();
  const { state, me } = ctx;
  const [split, setSplit] = useState(9);
  const [a, b] = state.members;
  const nm = (id: string) => (id === me?.id ? 'You' : firstName(state.members.find((m) => m.id === id)?.name || ''));
  const rounds = plannedRounds(state, ctx.place).slice().sort((x, y) => x.data.day - y.data.day || teeMinutes(x.data.time) - teeMinutes(y.data.time));
  const date = pickOf<DateData>(state, 'date').option?.data.start;
  const per = Math.ceil(18 / split);
  const total = rounds.length * per;
  return (
    <div className="cup-preview">
      <div className="duel-vs"><span className="team-a-text">{nm(a.id)}</span><span className="match-vs">vs</span><span className="team-b-text">{nm(b.id)}</span></div>
      <p className="sub">One on one match play, kept as a running record. Each match is a point; pick how long a match is.</p>
      <div className="seg seg-small" role="group" aria-label="Match length">
        {[18, 9, 6].map((x) => <button key={x} type="button" aria-pressed={split === x} onClick={() => setSplit(x)}>{x === 18 ? 'Full 18' : `Every ${x}`}</button>)}
      </div>
      {rounds.length > 0 ? (
        <div className="cup-preview-rounds">
          {rounds.map((r) => (
            <div className="row" key={r.id}>
              <div className="grow">
                <div className="row-title">{date ? dayLabel(date, r.data.day) : `Day ${r.data.day}`}{r.data.time ? ` · ${r.data.time}` : ''} · {r.data.course}</div>
                <div className="row-meta">{per === 1 ? 'One 18-hole match' : split === 9 ? 'Front 9 and back 9' : `${per} matches: ${Array.from({ length: per }, (_, k) => `${k * split + 1}–${Math.min(18, (k + 1) * split)}`).join(', ')}`}</div>
              </div>
              <span className="chip plain">{per} {per === 1 ? 'match' : 'matches'}</span>
            </div>
          ))}
          <div className="cup-preview-total"><span>{total} matches on the trip</span><b>{pts(total / 2 + 0.5)} to win</b></div>
        </div>
      ) : <p className="hint">Add rounds to the plan and each one shows up here. Playing 36 in a day? Add a morning and an afternoon round.</p>}
      {me?.is_organizer && <button className="btn primary" onClick={() => duelSheet(ctx, split)}>Start match play</button>}
    </div>
  );
}

function DuelForm({ ctx, split: start }: { ctx: TripCtx; split: number }) {
  const { state, me } = ctx;
  const [a, b] = state.members;
  const [name, setName] = useState(`${firstName(a.name)} vs ${firstName(b.name)}`);
  const [split, setSplit] = useState(start);
  const [hcp, setHcp] = useState<Record<string, string>>({ [a.id]: '', [b.id]: '' });
  const [busy, setBusy] = useState(false);
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const ok = await ctx.act('cup', { op: 'setup', mode: 'duel', name, hcp, players: [me?.id === b.id ? b.id : a.id, me?.id === b.id ? a.id : b.id], split });
      setBusy(false);
      if (ok) { ctx.sheet(null); ctx.toast('Match play is on. Set each round’s matches on the Cup tab.'); }
    }}>
      <div className="field"><label htmlFor="duel-name">Name</label><input id="duel-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field">
        <label>Handicaps (optional)</label>
        <div className="hcp-list">
          {[a, b].map((p) => (
            <label key={p.id} className="hcp-row">
              <span className="grow">{p.id === me?.id ? 'You' : p.name}</span>
              <input type="number" inputMode="numeric" step={1} min={-10} max={54} placeholder="—" value={hcp[p.id]} onChange={(e) => setHcp((h) => ({ ...h, [p.id]: e.target.value }))} />
            </label>
          ))}
        </div>
        <p className="hint">With both filled in, the higher handicap gets strokes on the hardest holes, split across each match (half on a 9). Leave blank to play straight up; you can add them later.</p>
      </div>
      <div className="field">
        <label>Each match is</label>
        <div className="seg">
          {[18, 9, 6].map((x) => <button key={x} type="button" aria-pressed={split === x} onClick={() => setSplit(x)}>{x === 18 ? '18 holes' : `${x} holes`}</button>)}
        </div>
        <p className="hint">{split === 18 ? 'One match a round.' : split === 9 ? 'Front 9 and back 9 are separate matches: two a round, four on a 36-hole day.' : 'Three matches a round: holes 1–6, 7–12 and 13–18.'} You can change it for any round.</p>
      </div>
      <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Start match play'}</button>
    </form>
  );
}
function duelSheet(ctx: TripCtx, split = 9) { ctx.sheet({ title: 'Match play', body: <DuelForm ctx={ctx} split={split} /> }); }

export function CupSection() {
  const ctx = useTrip();
  const { state, me } = ctx;
  if (!me || !('cup' in state.trip)) return null; // database not updated yet
  const ids = new Set(state.members.map((m) => m.id));
  const raw = state.trip.cup;
  // Drop anyone who has left the trip.
  const cup = raw ? { ...raw, teams: raw.teams.map((t) => ({ ...t, members: t.members.filter((id) => ids.has(id)) })) as CupT['teams'] } : null;
  if (!cup && state.members.length === 2) return <DuelPreview />;
  if (!cup) {
    if (!me.is_organizer || state.members.length < 4) return null;
    return (
      <div className="card cup-pitch">
        <div className="eyebrow">Make it a competition</div>
        <div className="row-title">Start a cup</div>
        <p className="sub">Two teams, two captains and a draft. Each round is team match play: scramble, alternate shot, best ball or singles. Every match is a point, and you enter who won. No scorecards.</p>
        <button className="btn primary" onClick={() => setupSheet(ctx)}>Set up the cup</button>
      </div>
    );
  }
  return cup.drafting ? <Draft cup={cup} /> : <Board cup={cup} />;
}

/* ---------- setup ---------- */
function SetupForm({ ctx }: { ctx: TripCtx }) {
  const { state, me } = ctx;
  const others = state.members.filter((m) => m.id !== me?.id);
  const [name, setName] = useState(`${state.trip.name.replace(/\s*trip$/i, '')} Cup`);
  const [capA, setCapA] = useState(me?.id || '');
  const [capB, setCapB] = useState(others[0]?.id || '');
  const [mode, setMode] = useState<'draft' | 'random'>('draft');
  const [busy, setBusy] = useState(false);
  const opt = (id: string) => state.members.map((m) => <option key={m.id} value={m.id} disabled={m.id === id}>{m.id === me?.id ? `${firstName(m.name)} (you)` : m.name}</option>);
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const ok = await ctx.act('cup', { op: 'setup', name, captains: [capA, capB], mode });
      setBusy(false);
      if (ok) { ctx.sheet(null); ctx.toast(mode === 'draft' ? 'Captains are set. Time to draft.' : 'Teams are set.'); }
    }}>
      <div className="field"><label htmlFor="cup-name">Name</label><input id="cup-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="cap-a">Captain 1</label><select id="cap-a" value={capA} onChange={(e) => setCapA(e.target.value)}>{opt(capB)}</select></div>
        <div className="field"><label htmlFor="cap-b">Captain 2</label><select id="cap-b" value={capB} onChange={(e) => setCapB(e.target.value)}>{opt(capA)}</select></div>
      </div>
      <div className="field">
        <label>Teams</label>
        <div className="seg">
          <button type="button" aria-pressed={mode === 'draft'} onClick={() => setMode('draft')}>Captains draft</button>
          <button type="button" aria-pressed={mode === 'random'} onClick={() => setMode('random')}>Random</button>
        </div>
        <p className="hint">{mode === 'draft' ? 'Captains take turns picking in the app: 1, 2, 2, 1, 1, 2… The organizer can pick for a captain who isn’t around.' : 'Everyone else is split evenly at random.'}</p>
      </div>
      <button className="btn primary block" disabled={busy || !capA || !capB}>{busy ? <span className="spinner" /> : 'Start the cup'}</button>
    </form>
  );
}
function setupSheet(ctx: TripCtx) { ctx.sheet({ title: 'Set up the cup', body: <SetupForm ctx={ctx} /> }); }

/* ---------- draft ---------- */
function Draft({ cup }: { cup: CupT }) {
  const { state, me, act } = useTrip();
  const turn = draftTurn(cup);
  const onClock = cup.teams[turn];
  const name = (id: string) => (id === me?.id ? 'You' : firstName(state.members.find((m) => m.id === id)?.name || ''));
  const pool = state.members.filter((m) => !cup.teams.some((t) => t.members.includes(m.id)));
  const canPick = me?.id === onClock.captain || me?.is_organizer;
  return (
    <section className="section cup">
      <div className="cup-head">
        <div className="eyebrow">{cup.name} · The draft</div>
        <div className={`cup-clock ${TEAM_CLASS[turn]}`}>{onClock.captain === me?.id ? 'You’re on the clock' : `${onClock.name} is on the clock`}</div>
      </div>
      <div className="cup-rosters">
        {cup.teams.map((t, i) => (
          <div key={i} className={`cup-roster ${TEAM_CLASS[i]}`}>
            <div className="cup-team-name">{t.name}</div>
            {t.members.map((id, k) => <div key={id} className="row-meta">{k === 0 ? <b>{name(id)} (C)</b> : `${k}. ${name(id)}`}</div>)}
          </div>
        ))}
      </div>
      {pool.length > 0 && (
        <div className="card">
          <div className="row-title">Up for grabs</div>
          <div className="cup-pool">
            {pool.map((m) => (
              <button key={m.id} className="chip-btn" disabled={!canPick} onClick={() => act('cup', { op: 'pick', member: m.id })}>
                <span className="avatar">{initials(m.name)}</span>{m.id === me?.id ? 'You' : m.name}
              </button>
            ))}
          </div>
          <p className="hint">{canPick ? `Tap a player to draft them to ${onClock.name}.` : `Waiting on ${name(onClock.captain)} to pick.`}</p>
        </div>
      )}
      {me?.is_organizer && <button className="link-btn" onClick={() => act('cup', { op: 'delete' })}>Cancel the cup</button>}
    </section>
  );
}

/* ---------- scoreboard, matches, results ---------- */
function Board({ cup }: { cup: CupT }) {
  const ctx = useTrip();
  const { state, me, act } = ctx;
  const score = cupScore(cup);
  const live = cupLive(cup);
  const name = (id: string) => (id === me?.id ? 'You' : firstName(state.members.find((m) => m.id === id)?.name || '?'));
  const liveMatches = cup.matches.filter((m) => !m.result && matchStatus(m).started);
  const myTeam = cup.teams.findIndex((t) => t.members.includes(me?.id || ''));
  const rounds = plannedRounds(state).slice().sort((a, b) => a.data.day - b.data.day || teeMinutes(a.data.time) - teeMinutes(b.data.time));
  const start = pickOf<DateData>(state, 'date').option?.data.start;
  // Only call a winner once every round has its matches; until then the total isn't known.
  const unpaired = rounds.filter((r) => !cup.matches.some((m) => m.round === r.id)).length;
  const winner: 0 | 1 | null = unpaired ? null : score.total && score.a >= score.toWin ? 0 : score.total && score.b >= score.toWin ? 1 : null;
  const unassigned = state.members.filter((m) => !cup.teams.some((t) => t.members.includes(m.id)));
  const players = cupPlayerPoints(cup);
  const leaders = [...players.entries()].sort((a, b) => b[1].pts - a[1].pts || a[1].played - b[1].played).slice(0, 5);
  const rec = cup.duel ? duelRecord(cup) : null;
  const pctA = score.total ? (score.a / score.total) * 100 : 0;
  const pctB = score.total ? (score.b / score.total) * 100 : 0;
  return (
    <section className="section cup">
      <div className="cup-board">
        <div className="eyebrow">{cup.duel ? `Match play · ${cup.name}` : `${cup.name}${myTeam >= 0 ? ` · you’re on ${cup.teams[myTeam].name}` : ''}`}</div>
        <div className="cup-score">
          {cup.teams.map((t, i) => (
            <div key={i} className={`cup-side ${TEAM_CLASS[i]}${winner === i ? ' won' : ''}`}>
              <div className="cup-team-name">{rec ? name(t.captain) : t.name}</div>
              <div className="cup-pts">{rec ? (i ? rec.l : rec.w) : pts(i ? score.b : score.a)}</div>
              {rec && <div className="cup-proj">{i ? `${rec.l}–${rec.w}` : `${rec.w}–${rec.l}`}{rec.h ? `–${rec.h}` : ''} · {i ? rec.holes.b : rec.holes.a} holes won</div>}
              {live.live > 0 && <div className="cup-proj">Projected {pts(i ? live.b : live.a)}</div>}
            </div>
          ))}
        </div>
        {score.total > 0 && (
          <>
            <div className="cup-bar" aria-hidden="true"><span className="team-a" style={{ width: `${pctA}%` }} /><span className="team-b" style={{ width: `${pctB}%` }} />{!unpaired && <i style={{ left: `${(score.toWin / score.total) * 100}%` }} />}</div>
            <div className="row-meta cup-status">
              {winner !== null ? (rec ? `${name(cup.teams[winner].captain)} ${name(cup.teams[winner].captain) === 'You' ? 'win' : 'wins'} the trip.` : `${cup.teams[winner].name} wins the cup.`) : unpaired ? [score.left - liveMatches.length > 0 ? `${score.left - liveMatches.length} match${score.left - liveMatches.length === 1 ? '' : 'es'} still to play` : '', liveMatches.length ? `${liveMatches.length} on the course` : '', `${unpaired} round${unpaired === 1 ? '' : 's'} still to pair`].filter(Boolean).join(' · ') : `${pts(score.toWin)} to win · ${score.left} match${score.left === 1 ? '' : 'es'} left`}
            </div>
          </>
        )}
        {rec && <div className="row-meta cup-status">Record is wins–losses{rec.h ? '–halves' : ''}. {rec.holes.half} hole{rec.holes.half === 1 ? '' : 's'} halved.</div>}
        {!rec && <details className="cup-teams">
          <summary>Teams</summary>
          <div className="cup-rosters">
            {cup.teams.map((t, i) => <div key={i} className={`cup-roster ${TEAM_CLASS[i]}`}><div className="cup-team-name">{t.name}</div><div className="row-meta">{andList(t.members.map((id) => (id === t.captain ? `${name(id)} (C)` : name(id))))}</div></div>)}
          </div>
        </details>}
      </div>

      <button type="button" className="card hcp-card" onClick={() => hcpSheet(ctx)}>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="row-title">{cup.net ? 'Playing off handicaps' : 'Playing straight up'}</span>
          <span className="row-meta">{cup.hcp && Object.keys(cup.hcp).length ? cup.teams.flatMap((t) => t.members).filter((id) => cup.hcp![id] !== undefined).map((id) => `${name(id)} ${cup.hcp![id]}`).join(' · ') : 'Add handicaps to give strokes'}</span>
        </span>
        <span className="link-btn">{me?.is_organizer ? 'Edit' : 'Set yours'}</span>
      </button>

      {liveMatches.length > 0 && (
        <div className="card cup-live">
          <div className="cup-live-head"><span className="live-dot" aria-hidden="true" /> Live now <span className="row-meta">· {liveMatches.length} match{liveMatches.length === 1 ? '' : 'es'} on the course</span></div>
          {liveMatches.map((m) => {
            const sa = m.a.map(name).join(' & '), sb = m.b.map(name).join(' & ');
            const st = matchStatus(m);
            return (
              <button key={m.id} type="button" className="cup-live-row" onClick={() => ctx.sheet({ title: 'Scorecard', body: <Scorecard matchId={m.id} /> })}>
                <span className="grow" style={{ minWidth: 0 }}>
                  <span className="cup-live-sides"><span className={st.lead > 0 ? 'team-a-text' : ''}>{sa}</span> <span className="match-vs">vs</span> <span className={st.lead < 0 ? 'team-b-text' : ''}>{sb}</span></span>
                  <span className={`row-meta ${st.lead > 0 ? 'team-a-text' : st.lead < 0 ? 'team-b-text' : ''}`}>{segLabel(m) ? `${segLabel(m)} · ` : ''}{statusLabel(m, rec ? name(cup.teams[0].captain) : cup.teams[0].name, rec ? name(cup.teams[1].captain) : cup.teams[1].name)}</span>
                </span>
                <HoleStrip m={m} />
              </button>
            );
          })}
        </div>
      )}

      {me?.is_organizer && unassigned.length > 0 && (
        <div className="card">
          <div className="row-title">Not on a team yet</div>
          {unassigned.map((m) => (
            <div className="row-inline" key={m.id}><span>{m.name}</span>{cup.teams.map((t, i) => <button key={i} className={`btn small ${TEAM_CLASS[i]}-btn`} onClick={() => act('cup', { op: 'move', member: m.id, team: i })}>{t.name}</button>)}</div>
          ))}
        </div>
      )}

      {rounds.length === 0 && <p className="hint">Add rounds to the plan, then set matches for each one here.</p>}
      {rounds.map((r) => <RoundMatches key={r.id} cup={cup} round={r} label={`${start ? dayLabel(start, r.data.day) : `Day ${r.data.day}`} · ${r.data.course}`} name={name} />)}

      {!rec && leaders.length > 0 && (
        <div className="card">
          <div className="row-title">Top points</div>
          {leaders.map(([id, p]) => {
            const t = cup.teams.findIndex((x) => x.members.includes(id));
            return <div className="row-inline" key={id}><span><span className={`team-dot ${t >= 0 ? TEAM_CLASS[t as 0 | 1] : ''}`} />{name(id)}</span><span className="row-meta">{pts(p.pts)} {p.pts === 1 ? 'pt' : 'pts'} · {p.w}-{p.l}-{p.h}</span></div>;
          })}
        </div>
      )}
      {me?.is_organizer && <button className="link-btn" onClick={() => { if (confirm(rec ? 'Delete the match play record and all results?' : 'End the cup and delete all matches and results?')) act('cup', { op: 'delete' }); }}>{rec ? 'Delete match play' : 'Delete the cup'}</button>}
    </section>
  );
}

function RoundMatches({ cup, round, label, name }: { cup: CupT; round: Option<RoundData>; label: string; name: (id: string) => string }) {
  const { me, act, toast } = useTrip();
  const matches = cup.matches.filter((m) => m.round === round.id);
  const [format, setFormat] = useState<CupFormat>(matches[0]?.format || 'scramble');
  const roundHoles = (h: CupMatch[]) => h.reduce((t, m) => Math.max(t, (m.from || 1) + m.holes - 1), 0);
  const [holes, setHoles] = useState<9 | 18>(matches.length ? (roundHoles(matches) <= 9 ? 9 : 18) : 18);
  const [split, setSplit] = useState<number>(matches[0]?.holes || cup.split || 18);
  const len = Math.min(split, holes);
  const lengths = holes === 18 ? [18, 9, 6] : [9, 3];
  const sitting = cup.sitting?.[round.id] || [];
  const any = matches.some((m) => m.result);
  const roundPts = matches.reduce((s, m) => { if (m.result === 'a') s[0]++; else if (m.result === 'b') s[1]++; else if (m.result === 'half') { s[0] += .5; s[1] += .5; } return s; }, [0, 0]);
  const make = async (seed: number) => { if (await act('cup', { op: 'matches', round: round.id, format: cup.duel ? 'singles' : format, holes, split: len, seed })) toast(cup.duel ? 'Matches set.' : 'Matches set. They’re also the tee-time groups.'); };
  const segs = matches.length ? new Set(matches.map((m) => m.from || 1)).size : 1;
  return (
    <div className="card cup-round">
      <div className="cup-round-head">
        <div><div className="row-title">{label}</div>{matches.length > 0 && <div className="row-meta">{[cup.duel ? '' : CUP_FORMATS[matches[0].format].label, segs > 1 ? `${segs} matches of ${matches[0].holes} holes` : `${matches[0].holes} holes`, !cup.duel && segs === 1 ? `${matches.length} match${matches.length > 1 ? 'es' : ''}` : ''].filter(Boolean).join(' · ')}</div>}</div>
        {any && <div className="cup-round-pts"><span className="team-a-text">{pts(roundPts[0])}</span>–<span className="team-b-text">{pts(roundPts[1])}</span></div>}
      </div>
      {matches.length === 0 ? (
        me?.is_organizer ? (
          <div className="cup-make">
            {!cup.duel && (
              <>
                <div className="cup-formats">
                  {(Object.keys(CUP_FORMATS) as CupFormat[]).map((f) => <button key={f} type="button" className="chip-btn" aria-pressed={format === f} onClick={() => setFormat(f)}>{CUP_FORMATS[f].label}</button>)}
                </div>
                <p className="hint">{CUP_FORMATS[format].blurb}</p>
              </>
            )}
            <div className="cup-len">
              <span className="row-meta">Playing</span>
              <div className="seg seg-small"><button type="button" aria-pressed={holes === 9} onClick={() => setHoles(9)}>9 holes</button><button type="button" aria-pressed={holes === 18} onClick={() => setHoles(18)}>18 holes</button></div>
            </div>
            <div className="cup-len">
              <span className="row-meta">Each match</span>
              <div className="seg seg-small">{lengths.map((x) => <button key={x} type="button" aria-pressed={len === x} onClick={() => setSplit(x)}>{x === holes ? `All ${x}` : `${x} holes`}</button>)}</div>
            </div>
            <p className="hint">{len >= holes ? `One match for the ${holes}.` : `${Math.ceil(holes / len)} matches: ${Array.from({ length: Math.ceil(holes / len) }, (_, k) => `holes ${k * len + 1}–${Math.min(holes, (k + 1) * len)}`).join(', ')}. Each is worth a point.`}</p>
            <button className="btn primary" onClick={() => make(Date.now() % 100000)}>Make matches</button>
          </div>
        ) : <p className="hint">The organizer hasn’t set matches for this round yet.</p>
      ) : (
        <>
          {matches.map((m) => <MatchRow key={m.id} m={m} cup={cup} name={name} />)}
          {sitting.length > 0 && <p className="hint">Sitting out: {andList(sitting.map(name))}. They play first next round.</p>}
          {me?.is_organizer && (
            <div className="btn-row">
              {!any && !cup.duel && <button className="btn small" onClick={() => make(Date.now() % 100000)}>Shuffle partners</button>}
              <button className="btn small ghost" onClick={() => { if (!any || confirm('Clear this round’s matches and results?')) act('cup', { op: 'clear_round', round: round.id }); }}>{cup.duel ? 'Change match length' : 'Change format'}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MatchRow({ m, cup, name }: { m: CupMatch; cup: CupT; name: (id: string) => string }) {
  const ctx = useTrip();
  const { act } = ctx;
  const [editing, setEditing] = useState(false);
  const [quick, setQuick] = useState(false);
  const side = (ids: string[]) => ids.map(name).join(' & ');
  const set = (result: CupResult | null, margin?: string) => { act('cup', { op: 'result', match: m.id, result, margin }); setEditing(false); setQuick(false); };
  const st = matchStatus(m);
  const done = !!m.result && !editing;
  const openCard = () => ctx.sheet({ title: 'Scorecard', body: <Scorecard matchId={m.id} /> });
  const leadClass = st.lead > 0 ? 'team-a-text' : st.lead < 0 ? 'team-b-text' : '';
  return (
    <div className={`match${done ? ' done' : ''}${st.started && !m.result ? ' live' : ''}`}>
      {segLabel(m) && <div className="match-seg">{segLabel(m)}</div>}
      <div className="match-sides">
        <div className={`match-side team-a${m.result === 'a' ? ' win' : ''}`}><span className="team-dot team-a" />{side(m.a)}</div>
        <span className="match-vs">vs</span>
        <div className={`match-side team-b${m.result === 'b' ? ' win' : ''}`}><span className="team-dot team-b" />{side(m.b)}</div>
      </div>
      {cup.net && <StrokeLine cup={cup} m={m} name={name} />}
      {m.twice?.length ? <div className="row-meta">{andList(m.twice.map(name))} {m.twice.length > 1 ? 'play' : 'plays'} once; the same score counts in this match too (uneven teams).</div> : null}
      {st.started && <HoleStrip m={m} onClick={openCard} />}
      {done ? (
        <div className="match-result">
          <span>{m.result === 'half' ? 'Halved' : `${cup.duel ? side(m.result === 'a' ? m.a : m.b) : cup.teams[m.result === 'a' ? 0 : 1].name} won${m.margin ? `, ${m.margin}` : ''}`}</span>
          {m.auto ? <button className="link-btn" onClick={openCard}>Scorecard</button> : <button className="link-btn" onClick={() => setEditing(true)}>Change</button>}
        </div>
      ) : st.started && !quick ? (
        <div className="match-live">
          <span className={`match-status ${leadClass}`}><span className="live-dot" aria-hidden="true" />{statusLabel(m, side(m.a), side(m.b))}</span>
          <button className="btn small primary" onClick={openCard}>Score hole {Math.min(m.holes, st.last + 1) + (m.from || 1) - 1}</button>
        </div>
      ) : !quick && !editing ? (
        <div className="match-start">
          <button className="btn primary" onClick={openCard}>Score it hole by hole</button>
          <button className="link-btn" onClick={() => setQuick(true)}>Just enter the result</button>
        </div>
      ) : (
        <div className="match-enter">
          <div className="seg seg-result">
            <button type="button" className="team-a-btn" onClick={() => set('a')}>{side(m.a)} won</button>
            <button type="button" onClick={() => set('half')}>Halved</button>
            <button type="button" className="team-b-btn" onClick={() => set('b')}>{side(m.b)} won</button>
          </div>
          {m.result ? <button className="link-btn" onClick={() => set(null)}>Clear result</button> : <button className="link-btn" onClick={() => { setQuick(false); setEditing(false); }}>Back</button>}
        </div>
      )}
      {done && !m.auto && m.result !== 'half' && !m.margin && (
        // A small link; the native picker opens over it when tapped.
        <label className="margin-add">
          + Add the margin
          <select aria-label="By how much" value="" onChange={(e) => set(m.result!, e.target.value)}>
            <option value="">By how much?</option>
            {marginsFor(m.holes).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

/** "Joe gets 3 strokes" under a match, when the cup plays off handicaps. */
function StrokeLine({ cup, m, name }: { cup: CupT; m: CupMatch; name: (id: string) => string }) {
  const st = matchStrokes(cup, m);
  const sum = (v: number[]) => v.reduce((t, x) => t + x, 0);
  const parts = Object.keys(st.players).length
    ? Object.entries(st.players).filter(([, v]) => sum(v) > 0).map(([id, v]) => `${name(id)} ${name(id) === 'You' ? 'get' : 'gets'} ${sum(v)}`)
    : [['a', m.a], ['b', m.b]].filter(([k]) => sum(st.sides[k as 'a' | 'b']) > 0).map(([k, ids]) => `${(ids as string[]).map(name).join(' & ')} get ${sum(st.sides[k as 'a' | 'b'])}`);
  return <div className="row-meta stroke-line">{parts.length ? `Strokes: ${parts.join(', ')}` : 'No strokes: same handicap'}</div>;
}

/** Everyone's handicap, and whether the cup plays off them. Players can set their own; the organizer anyone's. */
function HcpForm({ ctx }: { ctx: TripCtx }) {
  const { state, me } = ctx;
  const cup = state.trip.cup!;
  const players = cup.teams.flatMap((t) => t.members);
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(players.map((id) => [id, cup.hcp?.[id] !== undefined ? String(cup.hcp[id]) : ''])));
  const [net, setNet] = useState(cup.net ?? true);
  const [busy, setBusy] = useState(false);
  const mine = (id: string) => id === me?.id || !!me?.is_organizer;
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      const values = Object.fromEntries(Object.entries(vals).filter(([id]) => mine(id)));
      const ok = await ctx.act('cup', { op: 'hcp', values, ...(me?.is_organizer ? { net } : {}) });
      setBusy(false); if (ok) ctx.sheet(null);
    }}>
      <p className="sub" style={{ margin: 0 }}>Course handicaps (whole numbers). The app works out who gets strokes on which holes; you still tap who won each hole after strokes.</p>
      <div className="hcp-list">
        {players.map((id) => {
          const m = state.members.find((x) => x.id === id);
          return (
            <label key={id} className="hcp-row">
              <span className="grow">{id === me?.id ? 'You' : m?.name || '?'}</span>
              <input type="number" inputMode="numeric" step={1} min={-10} max={54} value={vals[id] ?? ''} disabled={!mine(id)} placeholder="—" onChange={(e) => setVals((v) => ({ ...v, [id]: e.target.value }))} />
            </label>
          );
        })}
      </div>
      {me?.is_organizer && (
        <label className="check-row"><input type="checkbox" checked={net} onChange={(e) => setNet(e.target.checked)} /> Play off handicaps (give strokes)</label>
      )}
      <details className="hint-more"><summary>How strokes work</summary>
        <ul>{(Object.keys(HCP_RULE) as CupFormat[]).filter((f) => !cup.duel || f === 'singles').map((f) => <li key={f}><b>{CUP_FORMATS[f].label}:</b> {HCP_RULE[f]}</li>)}
          <li>Shorter matches get their share: a 9-hole match gets half the strokes, a 6-hole match a third, on that stretch’s hardest holes.</li></ul>
      </details>
      <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Save handicaps'}</button>
    </form>
  );
}
function hcpSheet(ctx: TripCtx) { ctx.sheet({ title: 'Handicaps', body: <HcpForm ctx={ctx} /> }); }

/** A course's stroke index, typed from its scorecard: which hole is hardest (1) to easiest (18). */
function SiForm({ ctx, round }: { ctx: TripCtx; round: string }) {
  const cup = ctx.state.trip.cup!;
  const course = (ctx.state.options.find((o) => o.id === round)?.data as RoundData | undefined)?.course || 'this course';
  const [vals, setVals] = useState<string[]>((cup.si?.[round] || Array(18).fill('')).map(String));
  const [busy, setBusy] = useState(false);
  const nums = vals.map((v) => Number(v));
  const dupes = new Set(nums.filter((n, i) => n && nums.indexOf(n) !== i));
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      const ok = await ctx.act('cup', { op: 'si', round, si: nums });
      setBusy(false); if (ok) ctx.sheet(null);
    }}>
      <p className="sub" style={{ margin: 0 }}>From the {course} scorecard: the “Handicap” or “HCP” row, holes 1 to 18. Each number 1 to 18 once.</p>
      {[0, 9].map((start) => (
        <div key={start} className="si-grid">
          {vals.slice(start, start + 9).map((v, k) => (
            <label key={k}><span>{start + k + 1}</span>
              <input inputMode="numeric" value={v} maxLength={2} className={dupes.has(Number(v)) ? 'bad' : ''} onChange={(e) => setVals((all) => { const n = all.slice(); n[start + k] = e.target.value.replace(/\D/g, ''); return n; })} />
            </label>
          ))}
        </div>
      ))}
      {dupes.size > 0 && <p className="hint" style={{ color: 'var(--bad, #b3261e)' }}>{[...dupes].join(', ')} {dupes.size === 1 ? 'is' : 'are'} in there twice.</p>}
      <div className="btn-row">
        <button className="btn primary" disabled={busy || dupes.size > 0 || nums.some((n) => !n || n > 18)}>{busy ? <span className="spinner" /> : 'Save'}</button>
        {cup.si?.[round] && <button type="button" className="btn ghost" onClick={async () => { if (await ctx.act('cup', { op: 'si', round, si: [] })) ctx.sheet(null); }}>Use the standard order</button>}
      </div>
    </form>
  );
}
function siSheet(ctx: TripCtx, round: string) { ctx.sheet({ title: 'Stroke index', body: <SiForm ctx={ctx} round={round} /> }); }

/** A row of little squares, one per hole, colored by who won it. */
function HoleStrip({ m, onClick }: { m: CupMatch; onClick?: () => void }) {
  return (
    <button type="button" className="hole-strip" style={{ gridTemplateColumns: `repeat(${m.holes}, 1fr)` }} onClick={onClick} aria-label="Open the scorecard">
      {Array.from({ length: m.holes }, (_, i) => {
        const h = m.play?.[i];
        return <span key={i} className={h === 'a' ? 'ha' : h === 'b' ? 'hb' : h === 'half' ? 'hh' : ''} />;
      })}
    </button>
  );
}

/** The scorecard sheet: tap who won the hole, and it moves to the next one. Any hole can be corrected. */
function Scorecard({ matchId }: { matchId: string }) {
  const ctx = useTrip();
  const { state, me, act } = ctx;
  const cup = state.trip.cup;
  const m0 = cup?.matches.find((x) => x.id === matchId);
  // Taps show at once; the saved card catches up a moment later.
  const [pending, setPending] = useState<Record<number, HoleWin>>({});
  const play = m0 ? Array.from({ length: m0.holes }, (_, i) => (i in pending ? pending[i] : m0.play?.[i] ?? null)) : [];
  const firstOpen = play.findIndex((h) => !h);
  const [sel, setSel] = useState<number | null>(null);
  // Once the saved card shows a tap, stop overriding it, so later edits by others come through.
  const saved = JSON.stringify(m0?.play || []);
  useEffect(() => {
    setPending((p) => {
      const n = { ...p }; let changed = false;
      for (const k of Object.keys(n)) if ((m0?.play?.[+k] ?? null) === n[+k]) { delete n[+k]; changed = true; }
      return changed ? n : p;
    });
  }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!cup || !m0) return <p className="sub">This match isn’t in the cup anymore.</p>;
  const m: CupMatch = { ...m0, play };
  const st = matchStatus(m);
  const off = m.from || 1; // the course's hole number for card position 0
  const hole = sel ?? (firstOpen < 0 ? m.holes - 1 : firstOpen);
  const nm = (id: string) => (id === me?.id ? 'You' : firstName(state.members.find((x) => x.id === id)?.name || '?'));
  const sa = m.a.map(nm).join(' & '), sb = m.b.map(nm).join(' & ');
  const save = async (w: HoleWin) => {
    const i = hole;
    setPending((p) => ({ ...p, [i]: w }));
    const after = play.slice(); after[i] = w;
    const nextOpen = after.findIndex((h, k) => k > i && !h);
    // Move on to the next hole, unless that tap ended the match.
    setSel(matchStatus({ ...m, play: after }).decided || nextOpen < 0 ? null : nextOpen);
    const ok = await act('cup', { op: 'hole', match: m.id, hole: i + 1, winner: w });
    if (!ok) setPending((p) => { const n = { ...p }; delete n[i]; return n; });
  };
  const leadClass = st.lead > 0 ? 'team-a-text' : st.lead < 0 ? 'team-b-text' : '';
  const strokes = matchStrokes(cup, m);
  // Who gets a stroke on the hole being entered, in words: "Joe gets a stroke" / "Joe gets 2".
  const strokeNote = (i: number) => {
    if (!cup.net) return '';
    const who = Object.entries(strokes.players).filter(([, v]) => v[i] > 0).map(([id, v]) => `${nm(id)}${v[i] > 1 ? ` (${v[i]})` : ''}`);
    if (who.length) return `Stroke: ${who.join(', ')}`;
    if (strokes.sides.a[i]) return `Stroke: ${sa}${strokes.sides.a[i] > 1 ? ` (${strokes.sides.a[i]})` : ''}`;
    if (strokes.sides.b[i]) return `Stroke: ${sb}${strokes.sides.b[i] > 1 ? ` (${strokes.sides.b[i]})` : ''}`;
    return 'No strokes on this hole';
  };
  const ownSi = cup.si?.[m.round]?.length === 18;
  return (
    <div className="scorecard">
      <div className="sc-sides">
        <div className="sc-side team-a"><span className="team-dot team-a" />{sa}{!cup.duel && <small>{cup.teams[0].name}</small>}</div>
        <div className="sc-side team-b"><span className="team-dot team-b" />{sb}{!cup.duel && <small>{cup.teams[1].name}</small>}</div>
      </div>
      <div className={`sc-status ${leadClass}`}>{statusLabel(m, sa, sb)}</div>

      {!st.decided || sel !== null ? (
        <div className="sc-entry">
          <div className="sc-hole"><span>Hole</span><b>{hole + off}</b>{play[hole] && <small>Change this hole</small>}</div>
          {cup.net && <div className={`sc-stroke${strokeNote(hole).startsWith('Stroke') ? ' on' : ''}`}>{strokeNote(hole)}<small> · SI {(ownSi ? cup.si![m.round] : DEFAULT_SI)[hole + off - 1]}</small></div>}
          <div className="sc-buttons">
            <button type="button" className={`sc-btn team-a-fill${play[hole] === 'a' ? ' on' : ''}`} onClick={() => save('a')}>{sa}<small>won the hole</small></button>
            <button type="button" className={`sc-btn half${play[hole] === 'half' ? ' on' : ''}`} onClick={() => save('half')}>Halved</button>
            <button type="button" className={`sc-btn team-b-fill${play[hole] === 'b' ? ' on' : ''}`} onClick={() => save('b')}>{sb}<small>won the hole</small></button>
          </div>
          {play[hole] && <button type="button" className="link-btn" onClick={() => save(null)}>Clear hole {hole + off}</button>}
        </div>
      ) : (
        <p className="sub">Match over. Tap any hole below to fix it.</p>
      )}

      {segLabel(m) && <div className="match-seg" style={{ textAlign: 'center' }}>{segLabel(m)}</div>}
      <div className="sc-grid" style={{ gridTemplateColumns: `repeat(${Math.min(9, m.holes)}, 1fr)` }} role="group" aria-label="Holes">
        {play.map((h, i) => (
          <button key={i} type="button" aria-pressed={i === hole && (!st.decided || sel !== null)} className={`sc-cell ${h === 'a' ? 'ha' : h === 'b' ? 'hb' : h === 'half' ? 'hh' : ''}`} onClick={() => setSel(i)}>
            <span>{i + off}</span><b>{h === 'a' ? 'W' : h === 'b' ? 'L' : h === 'half' ? '½' : ''}</b>
            {cup.net && (strokes.sides.a[i] > 0 || strokes.sides.b[i] > 0) && (
              <i className="sc-dots" aria-label="strokes">{Array.from({ length: strokes.sides.a[i] }, (_, k) => <em key={`a${k}`} className="team-a" />)}{Array.from({ length: strokes.sides.b[i] }, (_, k) => <em key={`b${k}`} className="team-b" />)}</i>
            )}
          </button>
        ))}
      </div>
      <p className="hint">W and L are from {cup.duel ? (sa === 'You' ? 'your' : `${sa}’s`) : `${cup.teams[0].name}’s`} side.{cup.net ? ' Dots mark strokes; tap who won the hole after strokes.' : ''} Everyone on the trip sees each hole as it’s entered.</p>
      {cup.net && (
        <p className="hint">
          {ownSi ? 'Strokes follow this course’s stroke index.' : 'Strokes follow a standard stroke-index order.'}{' '}
          <button type="button" className="link-btn" onClick={() => siSheet(ctx, m.round)}>{ownSi ? 'Edit the stroke index' : 'Enter it from the scorecard'}</button>
        </p>
      )}
    </div>
  );
}
