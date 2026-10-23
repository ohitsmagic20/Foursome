'use client';

import type { DateData, DestinationData, LodgingData, Member } from '@/lib/shared';
import { bedsNeeded, clockLabel, openVotes, costOf, dayLabel, groupNames, money, parseDay, pickOf, plannedRounds, rangeLabel, teeAfter, teeMinutes, teeTimesNeeded, nightsOf, tripNights } from '@/lib/shared';
import { api, clearToken, firstName, initials } from '@/lib/client';
import { useEffect, useState } from 'react';
import { Callout, Chip, ConfirmButton, Icon, useTrip, type TripCtx } from '../ui';
import { meSheet } from '../sheets';
import { NotifyCard } from '../notify';

export function TripTab() {
  const ctx = useTrip();
  const { state, me, go } = ctx;
  const n = state.members.length;
  const date = pickOf<DateData>(state, 'date');
  const dest = pickOf<DestinationData>(state, 'destination');
  const stay = pickOf<LodgingData>(state, 'lodging');
  const rounds = plannedRounds(state);
  const booked = rounds.filter((r) => r.data.booked).length;
  const flown = state.members.filter((m) => m.flight_price !== null).length;
  const avg = n ? state.members.reduce((s, m) => s + costOf(state, m).total, 0) / n : 0;

  let countdown: number | null = null;
  if (date.locked && date.option) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    countdown = Math.round((parseDay(date.option.data.start).getTime() - t.getTime()) / 864e5);
  }

  const status = (done: boolean, open: string) => done ? <Chip kind="good">Done</Chip> : <Chip kind="warn">{open}</Chip>;
  const steps = [
    { tab: 'vote' as const, title: 'Dates', meta: date.option ? `${rangeLabel(date.option.data.start, nightsOf(state.trip, date.option.data))} ${date.locked ? 'locked' : 'leading'}` : 'Nobody has suggested dates yet', chip: status(date.locked, date.option ? 'Voting' : 'To do') },
    { tab: 'vote' as const, title: 'Destination', meta: dest.option ? `${dest.option.data.name} ${dest.locked ? 'locked' : 'leading'}` : 'Nobody has suggested a place yet', chip: status(dest.locked, dest.option ? 'Voting' : 'To do') },
    { tab: 'stay' as const, title: 'Where we’re staying', meta: stay.option ? `${stay.option.data.name} ${stay.locked ? 'locked' : 'leading'}` : 'Suggest a house or hotel', chip: status(stay.locked, stay.option ? 'Voting' : 'To do') },
    { tab: 'golf' as const, title: 'Tee times', meta: rounds.length ? `${booked} of ${rounds.length} rounds booked · ${teeTimesNeeded(n)} tee times each` : 'No rounds in the plan yet', chip: status(rounds.length > 0 && booked === rounds.length, rounds.length ? `${rounds.length - booked} to book` : 'To do') },
    { tab: 'flights' as const, title: 'Flights', meta: `${flown} of ${n} have picked a flight`, chip: status(flown === n, `${n - flown} left`) },
  ];
  const doneCount = steps.filter((s) => s.chip.props.kind === 'good').length;
  const over = state.members.filter((m) => m.budget > 0 && costOf(state, m).total > m.budget);

  return (
    <>
      <div className="summary">
        <div className="stat"><span className="k">{date.locked ? 'Tee off in' : 'Dates'}</span><span className="v">{countdown !== null ? (countdown >= 0 ? `${countdown}d` : 'Done') : 'TBD'}</span><span className="n">{date.locked && date.option ? rangeLabel(date.option.data.start, nightsOf(state.trip, date.option.data)) : 'Still voting'}</span></div>
        <div className="stat"><span className="k">Crew</span><span className="v">{n}</span><span className="n">{teeTimesNeeded(n)} foursome{teeTimesNeeded(n) > 1 ? 's' : ''}</span></div>
        <div className="stat"><span className="k">Per person</span><span className="v">{money(avg)}</span><span className="n">avg. so far</span></div>
      </div>

      <GetStarted />
      <TripPlan />
      <YourTurn />

      <section className="section">
        <div className="section-head"><h2>Trip checklist</h2><span className="sub">{doneCount} of {steps.length} settled</span></div>
        <div className="list">
          {steps.map((s) => (
            <button key={s.title} className="row" onClick={() => go(s.tab)}>
              <div className="grow"><div className="row-title">{s.title}</div><div className="row-meta">{s.meta}</div></div>
              {s.chip}{Icon.chev}
            </button>
          ))}
        </div>
      </section>

      <Arrivals />

      <section className="section">
        <div className="section-head"><h2>Cost per person</h2><span className="sub">{stay.option ? '' : 'Lodging not picked yet'}</span></div>
        <CostTable />
        {over.length > 0 && <Callout kind="warn">{over.map((m) => firstName(m.name)).join(', ')} {over.length > 1 ? 'are' : 'is'} over budget with the current picks.</Callout>}
        <p className="hint">Sharing a bed saves 25% on the stay. Food: {money(state.trip.food)} each.</p>
      </section>

      <NotifyCard />
      <Crew />
      <p className="legal-links"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
    </>
  );
}

/** Once dates and destination are locked: the whole trip on one card, plus calendar and share. */
function TripPlan() {
  const ctx = useTrip();
  const { state, me } = ctx;
  const date = pickOf<DateData>(state, 'date');
  const dest = pickOf<DestinationData>(state, 'destination');
  if (!date.locked || !dest.locked || !date.option || !dest.option) return null;
  const start = date.option.data.start;
  const stay = pickOf<LodgingData>(state, 'lodging');
  const rounds = plannedRounds(state).slice().sort((a, b) => a.data.day - b.data.day || teeMinutes(a.data.time) - teeMinutes(b.data.time));
  const landed = state.members.filter((m) => m.flight_arrive_at).sort((a, b) => a.flight_arrive_at!.localeCompare(b.flight_arrive_at!));
  const lastIn = landed[landed.length - 1];
  const mine = me ? costOf(state, me) : null;
  const cal = me && state.calKey ? `/api/trips/${state.trip.code}/calendar?m=${me.id}&k=${state.calKey}` : '';

  const shareText = [
    `⛳ ${state.trip.name}`,
    `${rangeLabel(start, tripNights(state))} · ${dest.option.data.name}`,
    stay.option ? `Staying: ${stay.option.data.name}${stay.locked ? '' : ' (leading)'}` : '',
    ...rounds.map((r) => `${dayLabel(start, r.data.day)} ${r.data.time}: ${r.data.course}${r.data.booked ? '' : ' (not booked yet)'}`),
  ].filter(Boolean).join('\n');

  return (
    <section className="plan">
      <div className="plan-head">
        <div className="eyebrow">The plan</div>
        <div className="plan-title">{dest.option.data.name}</div>
        <div className="row-meta">{rangeLabel(start, tripNights(state))} · {tripNights(state)} nights · {state.members.length} {state.members.length === 1 ? 'golfer' : 'golfers'}</div>
      </div>
      <div className="plan-rows">
        <div className="plan-row"><span className="k">Stay</span><span>{stay.option ? <>{stay.option.data.url ? <a href={stay.option.data.url} target="_blank" rel="noopener noreferrer">{stay.option.data.name}</a> : stay.option.data.name}{!stay.locked && <span className="row-meta"> · still voting</span>}</> : <span className="row-meta">Not picked yet</span>}</span></div>
        {Array.from({ length: tripNights(state) + 1 }, (_, i) => i + 1).map((d) => {
          const rs = rounds.filter((r) => r.data.day === d);
          return (
            <div className="plan-row" key={d}>
              <span className="k">{dayLabel(start, d)}</span>
              <span>{rs.length ? rs.map((r) => <span key={r.id} style={{ display: 'block' }}>{r.data.time} · {r.data.course}{!r.data.booked && <span className="row-meta"> · not booked</span>}{groupNames(state, r.data.groups).map((g, i) => <span key={i} className="row-meta" style={{ display: 'block' }}>{teeAfter(r.data.time, i)}: {g}</span>)}</span>) : <span className="row-meta">{d === 1 ? 'Travel in' : d === tripNights(state) + 1 ? 'Travel home' : 'No golf yet'}</span>}</span>
            </div>
          );
        })}
        {lastIn && <div className="plan-row"><span className="k">Arrivals</span><span>{landed.length} of {state.members.length} have flights · last in {firstName(lastIn.name)}, {clockLabel(lastIn.flight_arrive_at!)}</span></div>}
        {mine && <div className="plan-row"><span className="k">Your cost</span><span><strong>{money(mine.total)}</strong> <span className="row-meta">flight {money(mine.flight)} · stay {money(mine.stay)} · golf {money(mine.golf)} · food {money(mine.food)}</span></span></div>}
      </div>
      <div className="btn-row">
        {cal && <a className="btn small" href={cal}>Add to Calendar</a>}
        <button className="btn small" onClick={() => share(ctx, shareText, `${location.origin}/t/${state.trip.code}`)}>Share the plan</button>
        {me?.is_organizer && <EmailPlan />}
      </div>
    </section>
  );
}

/** Everything still waiting on my vote, across every tab. */
function YourTurn() {
  const { state, go } = useTrip();
  const o = openVotes(state);
  const rows = [
    { n: o.date, tab: 'vote' as const, one: 'date option', many: 'date options' },
    { n: o.destination, tab: 'vote' as const, one: 'destination', many: 'destinations' },
    { n: o.lodging, tab: 'stay' as const, one: 'place to stay', many: 'places to stay' },
    { n: o.round, tab: 'golf' as const, one: 'round of golf', many: 'rounds of golf' },
  ].filter((r) => r.n > 0);
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (!state.options.length) return null;
  if (!total) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>Your vote</h2><span className="sub">{total} waiting on you</span></div>
      <div className="list">
        {rows.map((r) => (
          <button key={r.one} className="row" onClick={() => go(r.tab)}>
            <div className="grow row-title">{r.n} {r.n === 1 ? r.one : r.many}</div>
            <span className="row-meta">Vote</span>{Icon.chev}
          </button>
        ))}
      </div>
    </section>
  );
}

function Arrivals() {
  const { state } = useTrip();
  const date = pickOf<DateData>(state, 'date');
  const withFlights = state.members.filter((m) => m.flight_arrive_at);
  if (!withFlights.length) return null;
  const sorted = withFlights.slice().sort((a, b) => a.flight_arrive_at!.localeCompare(b.flight_arrive_at!));
  const last = sorted[sorted.length - 1];
  const firstRound = plannedRounds(state).filter((r) => r.data.day === 1).sort((a, b) => teeMinutes(a.data.time) - teeMinutes(b.data.time))[0];
  let late: Member[] = [];
  if (firstRound && date.option) {
    const tee = teeMinutes(firstRound.data.time);
    late = sorted.filter((m) => {
      const [d, t] = m.flight_arrive_at!.split('T');
      if (d > date.option!.data.start) return true;
      const [h, mi] = t.split(':').map(Number);
      return h * 60 + mi + 90 > tee; // 90 minutes to get bags, a car and to the course
    });
  }
  return (
    <section className="section">
      <div className="section-head"><h2>Who lands when</h2><span className="sub">Last in: {firstName(last.name)}</span></div>
      <div className="list board">
        {sorted.map((m) => (
          <div className="row" key={m.id}>
            <span className="time">{clockLabel(m.flight_arrive_at!)}</span>
            <div className="grow"><div className="row-title">{m.name}</div><div className="row-meta">{m.flight_summary || m.airport}</div></div>
            {late.includes(m) && <Chip kind="bad">Misses tee time</Chip>}
          </div>
        ))}
      </div>
      {firstRound && date.option && <p className="hint">First tee: {firstRound.data.time}, {dayLabel(date.option.data.start, 1)}.</p>}
    </section>
  );
}

function CostTable() {
  const { state } = useTrip();
  const rows = state.members.map((m) => ({ m, c: costOf(state, m) }));
  const sum = (k: 'flight' | 'stay' | 'golf' | 'food' | 'total') => rows.reduce((s, r) => s + r.c[k], 0);
  return (
    <div className="scroll">
      <table className="sc">
        <thead><tr><th className="name">Golfer</th><th className="num">Flight</th><th className="num">Stay</th><th className="num">Golf</th><th className="num">Food</th><th className="num">Total</th><th className="num">Budget</th></tr></thead>
        <tbody>
          {rows.map(({ m, c }) => {
            const diff = m.budget - c.total;
            return (
              <tr key={m.id} className={m.id === state.meId ? 'me' : ''}>
                <td className="name">{firstName(m.name)}</td>
                <td className="num">{m.flight_price === null ? <span className="row-meta">—</span> : money(c.flight)}</td>
                <td className="num">{money(c.stay)}</td>
                <td className="num">{money(c.golf)}</td>
                <td className="num">{money(c.food)}</td>
                <td className="num"><strong>{money(c.total)}</strong></td>
                <td className="num">{m.budget > 0 ? (diff >= 0 ? <Chip kind="good">{money(diff)} under</Chip> : <Chip kind="bad">{money(-diff)} over</Chip>) : <span className="row-meta">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot><tr><td className="name">Group</td><td className="num">{money(sum('flight'))}</td><td className="num">{money(sum('stay'))}</td><td className="num">{money(sum('golf'))}</td><td className="num">{money(sum('food'))}</td><td className="num">{money(sum('total'))}</td><td /></tr></tfoot>
      </table>
    </div>
  );
}

function Crew() {
  const ctx = useTrip();
  const { state, me } = ctx;
  return (
    <section className="section">
      <div className="section-head"><h2>Crew</h2><span className="sub">{state.members.length} going</span></div>
      <div className="list">
        {state.members.map((m) => (
          <div className="row" key={m.id}>
            <div className="avatar">{initials(m.name)}</div>
            <div className="grow">
              <div className="row-title">{m.name}{m.is_organizer && <> <Chip kind="plain">Organizer</Chip></>}{m.id === me?.id && <> <Chip kind="flag">You</Chip></>}</div>
              <div className="row-meta">{m.airport || 'No airport yet'} · {m.bed === 'own' ? 'Own bed' : 'Will share'}{m.budget ? ` · budget ${money(m.budget)}` : ''}</div>
            </div>
            {m.id === me?.id && <button className="btn small ghost" onClick={() => meSheet(ctx)}>Edit</button>}
          </div>
        ))}
      </div>
      <InviteButton ctx={ctx} className="btn primary block" label="Invite people" />
      <GroupUpdate ctx={ctx} />
      {me?.is_organizer ? <RemoveMember ctx={ctx} /> : (
        <ConfirmButton className="btn ghost danger block" label="Leave this trip" confirmLabel="Tap again to leave"
          onConfirm={async () => { if (await ctx.act('leave')) { clearToken(state.trip.code); location.href = '/'; } }} />
      )}
    </section>
  );
}

function InviteButton({ ctx, className, label }: { ctx: TripCtx; className: string; label: string }) {
  return (
    <button className={className} onClick={() => {
      const url = `${location.origin}/t/${ctx.state.trip.code}`;
      const text = `Join our golf trip “${ctx.state.trip.name}” and vote on dates, where we stay and where we play:`;
      share(ctx, text, url);
    }}>{label}</button>
  );
}

function GroupUpdate({ ctx }: { ctx: TripCtx }) {
  const { state } = ctx;
  return (
    <button className="btn ghost block" onClick={() => {
      const date = pickOf<DateData>(state, 'date'), dest = pickOf<DestinationData>(state, 'destination'), stay = pickOf<LodgingData>(state, 'lodging');
      const waiting = state.members.filter((m) => !state.votes.some((v) => v.member_id === m.id)).map((m) => firstName(m.name));
      const lines = [
        `⛳ ${state.trip.name}`,
        date.option ? `Dates: ${rangeLabel(date.option.data.start, nightsOf(state.trip, date.option.data))}${date.locked ? ' (locked)' : ' (leading)'}` : 'Dates: suggest some',
        dest.option ? `Where: ${dest.option.data.name}${dest.locked ? ' (locked)' : ' (leading)'}` : 'Where: suggest a place',
        stay.option ? `Stay: ${stay.option.data.name}${stay.locked ? ' (locked)' : ' (leading)'}` : '',
        waiting.length ? `Still need votes from: ${waiting.join(', ')}` : '',
      ].filter(Boolean);
      share(ctx, lines.join('\n'), `${location.origin}/t/${state.trip.code}`);
    }}>Text the group an update</button>
  );
}

async function share(ctx: TripCtx, text: string, url: string) {
  if (navigator.share) {
    try { await navigator.share({ text, url }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    ctx.toast('Copied. Paste it in the group text.');
  } catch {
    ctx.sheet({ title: 'Copy this', body: <textarea className="card" style={{ width: '100%', minHeight: 140 }} readOnly defaultValue={`${text}\n${url}`} /> });
  }
}

function RemoveMember({ ctx }: { ctx: TripCtx }) {
  const others = ctx.state.members.filter((m) => !m.is_organizer);
  if (!others.length) return null;
  return (
    <details>
      <summary className="hint" style={{ cursor: 'pointer' }}>Remove someone from the trip</summary>
      <div className="list" style={{ marginTop: 8 }}>
        {others.map((m) => (
          <div className="row" key={m.id}>
            <div className="grow">{m.name}</div>
            <ConfirmButton className="btn small danger" label="Remove" confirmLabel="Tap to confirm" onConfirm={() => ctx.act('remove_member', { memberId: m.id })} />
          </div>
        ))}
      </div>
    </details>
  );
}

/** Organizer: email everyone with an account the plan, with their own cost. */
function EmailPlan() {
  const { state, toast } = useTrip();
  const [busy, setBusy] = useState(false);
  const code = state.trip.code;
  return (
    <button className="btn small" disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const r = await api<{ sent: number; of: number }>(`/api/trips/${code}/actions`, { code, body: { type: 'email_plan' } });
        toast(r.sent ? `Emailed the plan to ${r.sent} of ${r.of}. Guests without an account need the share link.` : 'Nobody on the trip has an account with trip emails on yet. Use Share the plan instead.');
      } catch (e) { toast(e instanceof Error ? e.message : 'Couldn’t email the plan.'); }
      setBusy(false);
    }}>{busy ? <span className="spinner" /> : 'Email the plan'}</button>
  );
}

/** First-time guide on a new trip: what to do, in order, with ticks as things get done. Hides once
 *  dates and destination are locked, or when dismissed on this phone. */
function GetStarted() {
  const ctx = useTrip();
  const { state, me, go } = ctx;
  const key = `foursome:intro:${state.trip.code}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => { try { setHidden(localStorage.getItem(key) === '1'); } catch { setHidden(false); } }, [key]);
  const date = pickOf<DateData>(state, 'date');
  const dest = pickOf<DestinationData>(state, 'destination');
  if (hidden || !me || (date.locked && dest.locked)) return null;
  const has = (k: string) => state.options.some((o) => o.kind === k);
  const voted = (k: string) => state.options.some((o) => o.kind === k && state.votes.some((v) => v.option_id === o.id && v.member_id !== o.created_by));
  const org = me.is_organizer;
  const steps: { done: boolean; title: string; meta: string; action?: React.ReactNode }[] = [
    { done: state.members.length > 1, title: 'Invite the group', meta: 'One link. Friends join with their name and home city, no app or password.',
      action: org ? <InviteButton ctx={ctx} className="btn small" label="Share invite link" /> : undefined },
    { done: has('destination'), title: 'Suggest where', meta: 'Add a destination or two. The closest airports fill in for you.', action: <button className="btn small ghost" onClick={() => go('vote')}>Go to Trip tab</button> },
    { done: has('date'), title: 'Suggest when', meta: 'Add a few date options. Each can be a different length: a long weekend next to a full week.' },
    { done: voted('date') || voted('destination'), title: 'Everyone votes', meta: 'Tap in, maybe or out on each option. You can see who hasn’t answered.' },
    { done: date.locked || dest.locked, title: org ? 'Lock the winners' : 'The organizer locks the winners', meta: 'Then pick a place to stay, add rounds of golf, and line up flights.' },
  ];
  const next = steps.findIndex((s) => !s.done);
  if (steps.filter((s) => s.done).length >= 3) return null;
  return (
    <section className="card get-started">
      <div className="section-head">
        <h2>Get started</h2>
        <button className="link-btn" onClick={() => { try { localStorage.setItem(key, '1'); } catch { /* ignore */ } setHidden(true); }}>Hide</button>
      </div>
      <ol className="gs-steps">
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? 'done' : i === next ? 'next' : ''}>
            <span className="gs-mark" aria-hidden>{s.done ? '✓' : i + 1}</span>
            <div className="grow">
              <div className="row-title">{s.title}{s.done && <span className="sr-only"> (done)</span>}</div>
              {!s.done && <div className="row-meta">{s.meta}</div>}
              {!s.done && i === next && s.action && <div style={{ marginTop: 8 }}>{s.action}</div>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
