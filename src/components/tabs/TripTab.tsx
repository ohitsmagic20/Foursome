'use client';

import type { DateData, DestinationData, LodgingData, Member } from '@/lib/shared';
import { bedsNeeded, clockLabel, costOf, dayLabel, money, parseDay, pickOf, plannedRounds, rangeLabel, teeMinutes, teeTimesNeeded } from '@/lib/shared';
import { firstName, initials } from '@/lib/client';
import { Callout, Chip, ConfirmButton, Icon, useTrip, type TripCtx } from '../ui';
import { meSheet } from '../sheets';

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
  const paid = state.members.filter((m) => m.paid).length;
  const avg = n ? state.members.reduce((s, m) => s + costOf(state, m).total, 0) / n : 0;

  let countdown: number | null = null;
  if (date.locked && date.option) {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    countdown = Math.round((parseDay(date.option.data.start).getTime() - t.getTime()) / 864e5);
  }

  const status = (done: boolean, open: string) => done ? <Chip kind="good">Done</Chip> : <Chip kind="warn">{open}</Chip>;
  const steps = [
    { tab: 'vote' as const, title: 'Dates', meta: date.option ? `${rangeLabel(date.option.data.start, state.trip.nights)} ${date.locked ? 'locked' : 'leading'}` : 'Nobody has suggested dates yet', chip: status(date.locked, date.option ? 'Voting' : 'To do') },
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
        <div className="stat"><span className="k">{date.locked ? 'Tee off in' : 'Dates'}</span><span className="v">{countdown !== null ? (countdown >= 0 ? `${countdown}d` : 'Done') : 'TBD'}</span><span className="n">{date.locked && date.option ? rangeLabel(date.option.data.start, state.trip.nights) : 'Still voting'}</span></div>
        <div className="stat"><span className="k">Crew</span><span className="v">{n}</span><span className="n">{teeTimesNeeded(n)} foursome{teeTimesNeeded(n) > 1 ? 's' : ''}</span></div>
        <div className="stat"><span className="k">Per person</span><span className="v">{money(avg)}</span><span className="n">avg. so far</span></div>
      </div>

      {n < 2 && me?.is_organizer && <Callout>Invite your group first. Everything else is decided by their votes. <InviteButton ctx={ctx} className="link-btn" label="Share the invite link" /></Callout>}

      <section className="section">
        <div className="section-head"><h2>Where things stand</h2><span className="sub">{doneCount} of {steps.length} settled</span></div>
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
        <p className="hint">Stay uses the locked or leading place, split so people sharing a bed pay 25% less. Golf counts rounds in the plan. Food and extras: {money(state.trip.food)} each.</p>
      </section>

      <Crew />
    </>
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
      {firstRound && date.option && <p className="hint">First tee time: {firstRound.data.time} on {dayLabel(date.option.data.start, 1)} at {firstRound.data.course}. Flags anyone landing less than 90 minutes before.</p>}
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
  const { state, me, act } = ctx;
  const stay = pickOf<LodgingData>(state, 'lodging').option;
  const need = bedsNeeded(state.members);
  const paid = state.members.filter((m) => m.paid).length;
  return (
    <section className="section">
      <div className="section-head"><h2>Crew</h2><span className="sub">{state.trip.deposit > 0 ? `${paid} of ${state.members.length} deposits in` : `${state.members.length} going`}</span></div>
      <div className="list">
        {state.members.map((m) => (
          <div className="row" key={m.id}>
            <div className="avatar">{initials(m.name)}</div>
            <div className="grow">
              <div className="row-title">{m.name}{m.is_organizer && <> <Chip kind="plain">Organizer</Chip></>}{m.id === me?.id && <> <Chip kind="flag">You</Chip></>}</div>
              <div className="row-meta">{m.airport || 'No airport yet'} · {m.bed === 'own' ? 'Own bed' : 'Will share'}{m.budget ? ` · budget ${money(m.budget)}` : ''}</div>
            </div>
            {m.id === me?.id && <button className="btn small ghost" onClick={() => meSheet(ctx)}>Edit</button>}
            {state.trip.deposit > 0 && (me?.is_organizer
              ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <button className="switch" role="switch" aria-checked={m.paid} aria-label={`${m.name} paid deposit`} onClick={() => act('set_paid', { memberId: m.id, paid: !m.paid })} />
                  <span className="row-meta" style={{ fontSize: 11 }}>{m.paid ? 'Paid' : 'Deposit'}</span>
                </div>
              : <Chip kind={m.paid ? 'good' : 'plain'}>{m.paid ? 'Paid' : 'Owes deposit'}</Chip>)}
          </div>
        ))}
      </div>
      {stay && <p className="hint">This group needs {need} beds. {stay.data.name} has {stay.data.beds || 'an unknown number of'}.</p>}
      <InviteButton ctx={ctx} className="btn primary block" label="Invite people" />
      <GroupUpdate ctx={ctx} />
      {me?.is_organizer && <RemoveMember ctx={ctx} />}
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
    <button className="btn block" onClick={() => {
      const date = pickOf<DateData>(state, 'date'), dest = pickOf<DestinationData>(state, 'destination'), stay = pickOf<LodgingData>(state, 'lodging');
      const waiting = state.members.filter((m) => !state.votes.some((v) => v.member_id === m.id)).map((m) => firstName(m.name));
      const lines = [
        `⛳ ${state.trip.name}`,
        date.option ? `Dates: ${rangeLabel(date.option.data.start, state.trip.nights)}${date.locked ? ' (locked)' : ' (leading)'}` : 'Dates: suggest some',
        dest.option ? `Where: ${dest.option.data.name}${dest.locked ? ' (locked)' : ' (leading)'}` : 'Where: suggest a place',
        stay.option ? `Stay: ${stay.option.data.name}${stay.locked ? ' (locked)' : ' (leading)'}` : '',
        waiting.length ? `Still need votes from: ${waiting.join(', ')}` : '',
        state.trip.deposit > 0 && state.members.some((m) => !m.paid) ? `Deposits (${money(state.trip.deposit)}) still due: ${state.members.filter((m) => !m.paid).map((m) => firstName(m.name)).join(', ')}` : '',
      ].filter(Boolean);
      share(ctx, lines.join('\n'), `${location.origin}/t/${state.trip.code}`);
    }}>Send a status update to the group text</button>
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
