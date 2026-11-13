'use client';

import { useEffect, useState } from 'react';
import type { Cup as CupT, CupFormat, CupMatch, CupResult, Option, RoundData } from '@/lib/shared';
import { CUP_FORMATS, CUP_MARGINS, andList, cupLive, cupPlayerPoints, cupScore, dayLabel, draftTurn, matchStatus, pickOf, plannedRounds, pts, statusLabel, teeMinutes } from '@/lib/shared';
import type { HoleWin } from '@/lib/shared';
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
  const { state, go } = ctx;
  if (!('cup' in state.trip)) return null;
  const cup = state.trip.cup;
  const score = cup ? cupScore(cup) : null;
  const live = cup ? cupLive(cup) : null;
  const line = !cup ? 'Not set up yet · see a preview'
    : cup.drafting ? 'The draft is on'
    : `${cup.teams[0].name} ${pts(score!.a)} · ${pts(score!.b)} ${cup.teams[1].name}${live!.live ? ` · ${live!.live} live` : ''}`;
  return (
    <details className="card cup-drop">
      <summary>
        <span className="cup-drop-icon" aria-hidden="true">{Icon.cup}</span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="eyebrow" style={{ display: 'block' }}>{cup ? cup.name : 'The Cup'}</span>
          <span className="row-title">{line}</span>
        </span>
      </summary>
      <div className="cup-drop-body">
        {cup ? <CupSection /> : <CupPreview />}
        {hasCupTab(state) && <button className="btn block" onClick={() => go('cup')}>Open the Cup tab</button>}
      </div>
    </details>
  );
}

/** What the cup would look like with the people on the trip now: two even teams, open spots, a match count per round. */
function CupPreview() {
  const ctx = useTrip();
  const { state, me } = ctx;
  const n = state.members.length;
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
              {live.live > 0 && <div className="cup-proj">Projected {pts(i ? live.b : live.a)}</div>}
            </div>
          ))}
        </div>
        {score.total > 0 && (
          <>
            <div className="cup-bar" aria-hidden="true"><span className="team-a" style={{ width: `${pctA}%` }} /><span className="team-b" style={{ width: `${pctB}%` }} />{!unpaired && <i style={{ left: `${(score.toWin / score.total) * 100}%` }} />}</div>
            <div className="row-meta cup-status">
              {winner !== null ? `${cup.teams[winner].name} wins the cup.` : unpaired ? [score.left - liveMatches.length > 0 ? `${score.left - liveMatches.length} match${score.left - liveMatches.length === 1 ? '' : 'es'} still to play` : '', liveMatches.length ? `${liveMatches.length} on the course` : '', `${unpaired} round${unpaired === 1 ? '' : 's'} still to pair`].filter(Boolean).join(' · ') : `${pts(score.toWin)} to win · ${score.left} match${score.left === 1 ? '' : 'es'} left`}
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
                  <span className={`row-meta ${st.lead > 0 ? 'team-a-text' : st.lead < 0 ? 'team-b-text' : ''}`}>{st.lead === 0 ? `All square thru ${st.thru}` : `${st.lead > 0 ? cup.teams[0].name : cup.teams[1].name} ${Math.abs(st.lead)} UP thru ${st.thru}${st.dormie ? ' · dormie' : ''}`}</span>
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
      <div className="match-sides">
        <div className={`match-side team-a${m.result === 'a' ? ' win' : ''}`}><span className="team-dot team-a" />{side(m.a)}</div>
        <span className="match-vs">vs</span>
        <div className={`match-side team-b${m.result === 'b' ? ' win' : ''}`}><span className="team-dot team-b" />{side(m.b)}</div>
      </div>
      {m.twice?.length ? <div className="row-meta">{andList(m.twice.map(name))} {m.twice.length > 1 ? 'play' : 'plays'} once; the same score counts in this match too (uneven teams).</div> : null}
      {st.started && <HoleStrip m={m} onClick={openCard} />}
      {done ? (
        <div className="match-result">
          <span>{m.result === 'half' ? 'Halved' : `${cup.teams[m.result === 'a' ? 0 : 1].name} won${m.margin ? `, ${m.margin}` : ''}`}</span>
          {m.auto ? <button className="link-btn" onClick={openCard}>Scorecard</button> : <button className="link-btn" onClick={() => setEditing(true)}>Change</button>}
        </div>
      ) : st.started && !quick ? (
        <div className="match-live">
          <span className={`match-status ${leadClass}`}><span className="live-dot" aria-hidden="true" />{statusLabel(m, side(m.a), side(m.b))}</span>
          <button className="btn small primary" onClick={openCard}>Score hole {Math.min(m.holes, st.last + 1)}</button>
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
            {CUP_MARGINS.filter((x) => m.holes === 18 || Number(x.split(/[& ]/)[0]) <= 5).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

/** A row of little squares, one per hole, colored by who won it. */
function HoleStrip({ m, onClick }: { m: CupMatch; onClick?: () => void }) {
  return (
    <button type="button" className={`hole-strip h${m.holes}`} onClick={onClick} aria-label="Open the scorecard">
      {Array.from({ length: m.holes }, (_, i) => {
        const h = m.play?.[i];
        return <span key={i} className={h === 'a' ? 'ha' : h === 'b' ? 'hb' : h === 'half' ? 'hh' : ''} />;
      })}
    </button>
  );
}

/** The scorecard sheet: tap who won the hole, and it moves to the next one. Any hole can be corrected. */
function Scorecard({ matchId }: { matchId: string }) {
  const { state, me, act } = useTrip();
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
  return (
    <div className="scorecard">
      <div className="sc-sides">
        <div className="sc-side team-a"><span className="team-dot team-a" />{sa}<small>{cup.teams[0].name}</small></div>
        <div className="sc-side team-b"><span className="team-dot team-b" />{sb}<small>{cup.teams[1].name}</small></div>
      </div>
      <div className={`sc-status ${leadClass}`}>{statusLabel(m, sa, sb)}</div>

      {!st.decided || sel !== null ? (
        <div className="sc-entry">
          <div className="sc-hole"><span>Hole</span><b>{hole + 1}</b>{play[hole] && <small>Change this hole</small>}</div>
          <div className="sc-buttons">
            <button type="button" className={`sc-btn team-a-fill${play[hole] === 'a' ? ' on' : ''}`} onClick={() => save('a')}>{sa}<small>won the hole</small></button>
            <button type="button" className={`sc-btn half${play[hole] === 'half' ? ' on' : ''}`} onClick={() => save('half')}>Halved</button>
            <button type="button" className={`sc-btn team-b-fill${play[hole] === 'b' ? ' on' : ''}`} onClick={() => save('b')}>{sb}<small>won the hole</small></button>
          </div>
          {play[hole] && <button type="button" className="link-btn" onClick={() => save(null)}>Clear hole {hole + 1}</button>}
        </div>
      ) : (
        <p className="sub">Match over. Tap any hole below to fix it.</p>
      )}

      <div className={`sc-grid h${m.holes}`} role="group" aria-label="Holes">
        {play.map((h, i) => (
          <button key={i} type="button" aria-pressed={i === hole && (!st.decided || sel !== null)} className={`sc-cell ${h === 'a' ? 'ha' : h === 'b' ? 'hb' : h === 'half' ? 'hh' : ''}`} onClick={() => setSel(i)}>
            <span>{i + 1}</span><b>{h === 'a' ? 'W' : h === 'b' ? 'L' : h === 'half' ? '½' : ''}</b>
          </button>
        ))}
      </div>
      <p className="hint">W and L are from {cup.teams[0].name}’s side. Everyone on the trip sees each hole as it’s entered.</p>
    </div>
  );
}
