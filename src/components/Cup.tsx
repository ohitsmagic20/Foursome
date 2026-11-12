'use client';

import { useState } from 'react';
import type { Cup as CupT, CupFormat, CupMatch, CupResult, Option, RoundData } from '@/lib/shared';
import { CUP_FORMATS, CUP_MARGINS, andList, cupPlayerPoints, cupScore, dayLabel, draftTurn, pickOf, plannedRounds, pts, teeMinutes } from '@/lib/shared';
import type { DateData } from '@/lib/shared';
import { firstName, initials } from '@/lib/client';
import { Icon, useTrip, type TripCtx } from './ui';

const TEAM_CLASS = ['team-a', 'team-b'] as const;

/** Team match play for the trip, Internet Invitational style: captains, a draft, a point a match. */
/** Whether the trip shows a Cup tab: once there's a cup, or a group big enough for one (4+). */
export function hasCupTab(state: TripCtx['state']): boolean {
  return !!state.trip.cup || state.members.length >= 4;
}

/** The Cup tab: set-up for the organizer, the draft, then the scoreboard and matches. */
export function CupTab() {
  const { state, me } = useTrip();
  if (!('cup' in state.trip)) {
    return (
      <section className="section">
        <div className="section-head"><h2>The Cup</h2></div>
        <div className="card empty">{me?.is_organizer
          ? 'The Cup needs a one-time database update before it can save teams and results. Run supabase/008_cup.sql in the Supabase SQL Editor, then come back.'
          : 'The Cup isn’t switched on for this trip yet.'}</div>
      </section>
    );
  }
  if (!state.trip.cup && !me?.is_organizer) {
    return (
      <section className="section">
        <div className="section-head"><h2>The Cup</h2></div>
        <div className="card cup-pitch">
          <div className="eyebrow">Coming soon, maybe</div>
          <div className="row-title">No cup yet</div>
          <p className="sub">When the organizer sets one up, you’ll see the teams, the draft and the pairings for each round here, and you can enter who won your match.</p>
        </div>
      </section>
    );
  }
  return (
    <>
      {!state.trip.cup && <div className="section-head"><h2>The Cup</h2></div>}
      <CupSection />
    </>
  );
}

/** On the Golf tab: a one-line score that opens the Cup tab. */
export function CupLink() {
  const { state, go } = useTrip();
  const cup = state.trip.cup;
  if (!cup) return null;
  const score = cupScore(cup);
  return (
    <button className="card cup-link" onClick={() => go('cup')}>
      <span className="grow" style={{ minWidth: 0, textAlign: 'left' }}>
        <span className="eyebrow" style={{ display: 'block' }}>{cup.name}</span>
        <span className="row-title">{cup.drafting ? 'The draft is on' : `${cup.teams[0].name} ${pts(score.a)} · ${pts(score.b)} ${cup.teams[1].name}`}</span>
      </span>
      {Icon.chev}
    </button>
  );
}

export function CupSection() {
  const ctx = useTrip();
  const { state, me } = ctx;
  if (!me || !('cup' in state.trip)) return null; // database not updated yet
  const ids = new Set(state.members.map((m) => m.id));
  const raw = state.trip.cup;
  // Drop anyone who has left the trip.
  const cup = raw ? { ...raw, teams: raw.teams.map((t) => ({ ...t, members: t.members.filter((id) => ids.has(id)) })) as CupT['teams'] } : null;
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
  const name = (id: string) => (id === me?.id ? 'You' : firstName(state.members.find((m) => m.id === id)?.name || '?'));
  const myTeam = cup.teams.findIndex((t) => t.members.includes(me?.id || ''));
  const rounds = plannedRounds(state).slice().sort((a, b) => a.data.day - b.data.day || teeMinutes(a.data.time) - teeMinutes(b.data.time));
  const start = pickOf<DateData>(state, 'date').option?.data.start;
  // Only call a winner once every round has its matches; until then the total isn't known.
  const unpaired = rounds.filter((r) => !cup.matches.some((m) => m.round === r.id)).length;
  const winner: 0 | 1 | null = unpaired ? null : score.total && score.a >= score.toWin ? 0 : score.total && score.b >= score.toWin ? 1 : null;
  const unassigned = state.members.filter((m) => !cup.teams.some((t) => t.members.includes(m.id)));
  const players = cupPlayerPoints(cup);
  const leaders = [...players.entries()].sort((a, b) => b[1].pts - a[1].pts || a[1].played - b[1].played).slice(0, 5);
  const pctA = score.total ? (score.a / score.total) * 100 : 0;
  const pctB = score.total ? (score.b / score.total) * 100 : 0;
  return (
    <section className="section cup">
      <div className="cup-board">
        <div className="eyebrow">{cup.name}{myTeam >= 0 ? ` · you’re on ${cup.teams[myTeam].name}` : ''}</div>
        <div className="cup-score">
          {cup.teams.map((t, i) => (
            <div key={i} className={`cup-side ${TEAM_CLASS[i]}${winner === i ? ' won' : ''}`}>
              <div className="cup-team-name">{t.name}</div>
              <div className="cup-pts">{pts(i ? score.b : score.a)}</div>
            </div>
          ))}
        </div>
        {score.total > 0 && (
          <>
            <div className="cup-bar" aria-hidden="true"><span className="team-a" style={{ width: `${pctA}%` }} /><span className="team-b" style={{ width: `${pctB}%` }} />{!unpaired && <i style={{ left: `${(score.toWin / score.total) * 100}%` }} />}</div>
            <div className="row-meta cup-status">
              {winner !== null ? `${cup.teams[winner].name} wins the cup.` : unpaired ? [score.left ? `${score.left} match${score.left === 1 ? '' : 'es'} waiting on a result` : '', `${unpaired} round${unpaired === 1 ? '' : 's'} still to pair`].filter(Boolean).join(' · ') : `${pts(score.toWin)} to win · ${score.left} match${score.left === 1 ? '' : 'es'} left`}
            </div>
          </>
        )}
        <details className="cup-teams">
          <summary>Teams</summary>
          <div className="cup-rosters">
            {cup.teams.map((t, i) => <div key={i} className={`cup-roster ${TEAM_CLASS[i]}`}><div className="cup-team-name">{t.name}</div><div className="row-meta">{andList(t.members.map((id) => (id === t.captain ? `${name(id)} (C)` : name(id))))}</div></div>)}
          </div>
        </details>
      </div>

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

      {leaders.length > 0 && (
        <div className="card">
          <div className="row-title">Top points</div>
          {leaders.map(([id, p]) => {
            const t = cup.teams.findIndex((x) => x.members.includes(id));
            return <div className="row-inline" key={id}><span><span className={`team-dot ${t >= 0 ? TEAM_CLASS[t as 0 | 1] : ''}`} />{name(id)}</span><span className="row-meta">{pts(p.pts)} {p.pts === 1 ? 'pt' : 'pts'} · {p.w}-{p.l}-{p.h}</span></div>;
          })}
        </div>
      )}
      {me?.is_organizer && <button className="link-btn" onClick={() => { if (confirm('End the cup and delete all matches and results?')) act('cup', { op: 'delete' }); }}>Delete the cup</button>}
    </section>
  );
}

function RoundMatches({ cup, round, label, name }: { cup: CupT; round: Option<RoundData>; label: string; name: (id: string) => string }) {
  const { me, act, toast } = useTrip();
  const matches = cup.matches.filter((m) => m.round === round.id);
  const [format, setFormat] = useState<CupFormat>(matches[0]?.format || 'scramble');
  const [holes, setHoles] = useState<9 | 18>(matches[0]?.holes || 18);
  const sitting = cup.sitting?.[round.id] || [];
  const any = matches.some((m) => m.result);
  const roundPts = matches.reduce((s, m) => { if (m.result === 'a') s[0]++; else if (m.result === 'b') s[1]++; else if (m.result === 'half') { s[0] += .5; s[1] += .5; } return s; }, [0, 0]);
  const make = async (seed: number) => { if (await act('cup', { op: 'matches', round: round.id, format, holes, seed })) toast('Matches set. They’re also the tee-time groups.'); };
  return (
    <div className="card cup-round">
      <div className="cup-round-head">
        <div><div className="row-title">{label}</div>{matches.length > 0 && <div className="row-meta">{CUP_FORMATS[matches[0].format].label} · {matches[0].holes} holes · {matches.length} match{matches.length > 1 ? 'es' : ''}</div>}</div>
        {any && <div className="cup-round-pts"><span className="team-a-text">{pts(roundPts[0])}</span>–<span className="team-b-text">{pts(roundPts[1])}</span></div>}
      </div>
      {matches.length === 0 ? (
        me?.is_organizer ? (
          <div className="cup-make">
            <div className="cup-formats">
              {(Object.keys(CUP_FORMATS) as CupFormat[]).map((f) => <button key={f} type="button" className="chip-btn" aria-pressed={format === f} onClick={() => setFormat(f)}>{CUP_FORMATS[f].label}</button>)}
            </div>
            <p className="hint">{CUP_FORMATS[format].blurb}</p>
            <div className="btn-row">
              <div className="seg seg-small"><button type="button" aria-pressed={holes === 9} onClick={() => setHoles(9)}>9 holes</button><button type="button" aria-pressed={holes === 18} onClick={() => setHoles(18)}>18 holes</button></div>
              <button className="btn primary" onClick={() => make(Date.now() % 100000)}>Make matches</button>
            </div>
          </div>
        ) : <p className="hint">The organizer hasn’t set matches for this round yet.</p>
      ) : (
        <>
          {matches.map((m) => <MatchRow key={m.id} m={m} cup={cup} name={name} />)}
          {sitting.length > 0 && <p className="hint">Sitting out: {andList(sitting.map(name))}. They play first next round.</p>}
          {me?.is_organizer && (
            <div className="btn-row">
              {!any && <button className="btn small" onClick={() => make(Date.now() % 100000)}>Shuffle partners</button>}
              <button className="btn small ghost" onClick={() => { if (!any || confirm('Clear this round’s matches and results?')) act('cup', { op: 'clear_round', round: round.id }); }}>Change format</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MatchRow({ m, cup, name }: { m: CupMatch; cup: CupT; name: (id: string) => string }) {
  const { act } = useTrip();
  const [editing, setEditing] = useState(false);
  const side = (ids: string[]) => ids.map(name).join(' & ');
  const set = (result: CupResult | null, margin?: string) => { act('cup', { op: 'result', match: m.id, result, margin }); setEditing(false); };
  const done = !!m.result && !editing;
  return (
    <div className={`match${done ? ' done' : ''}`}>
      <div className="match-sides">
        <div className={`match-side team-a${m.result === 'a' ? ' win' : ''}`}><span className="team-dot team-a" />{side(m.a)}</div>
        <span className="match-vs">vs</span>
        <div className={`match-side team-b${m.result === 'b' ? ' win' : ''}`}><span className="team-dot team-b" />{side(m.b)}</div>
      </div>
      {m.twice?.length ? <div className="row-meta">{andList(m.twice.map(name))} {m.twice.length > 1 ? 'play' : 'plays'} once; the same score counts in this match too (uneven teams).</div> : null}
      {done ? (
        <div className="match-result">
          <span>{m.result === 'half' ? 'Halved' : `${cup.teams[m.result === 'a' ? 0 : 1].name} won${m.margin ? `, ${m.margin}` : ''}`}</span>
          <button className="link-btn" onClick={() => setEditing(true)}>Change</button>
        </div>
      ) : (
        <div className="match-enter">
          <div className="seg seg-result">
            <button type="button" className="team-a-btn" onClick={() => set('a')}>{side(m.a)} won</button>
            <button type="button" onClick={() => set('half')}>Halved</button>
            <button type="button" className="team-b-btn" onClick={() => set('b')}>{side(m.b)} won</button>
          </div>
          {m.result && <button className="link-btn" onClick={() => set(null)}>Clear result</button>}
        </div>
      )}
      {done && m.result !== 'half' && !m.margin && (
        // A small link; the native picker opens over it when tapped.
        <label className="margin-add">
          + Add the margin
          <select aria-label="By how much" value="" onChange={(e) => set(m.result!, e.target.value)}>
            <option value="">By how much?</option>
            {CUP_MARGINS.filter((x) => m.holes === 18 || Number(x.split(/[& ]/)[0]) <= 5).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
