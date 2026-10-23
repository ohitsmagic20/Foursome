'use client';

import type { DateData, DestinationData, Option, RoundData } from '@/lib/shared';
import { dayLabel, groupNames, isWeekendDay, teeAfter, money, optionsOf, pickOf, plannedRounds, tally, teeMinutes, teeTimesNeeded, tripNights } from '@/lib/shared';
import { Callout, Chip, Icon, LockButton, Tally, VoteControl, canEdit, useTrip } from '../ui';
import { pairingsSheet, roundSheet } from '../sheets';
import { CoursesNearby, DayWeather, WeatherCredit, useWeather } from '../live';

export function GolfTab() {
  const ctx = useTrip();
  const { state } = ctx;
  const n = state.members.length;
  const days = tripNights(state) + 1;
  const date = pickOf<DateData>(state, 'date').option;
  const rounds = optionsOf<RoundData>(state, 'round');
  const plan = plannedRounds(state);
  const destOpt = pickOf<DestinationData>(state, 'destination').option;
  const wx = useWeather(destOpt?.data.name, date?.data.start, tripNights(state));
  const perPerson = plan.reduce((s, r) => s + (Number(r.data.fee) || 0), 0);

  return (
    <>
      <Callout>Your group of {n} needs <strong>{teeTimesNeeded(n)} back-to-back tee time{teeTimesNeeded(n) > 1 ? 's' : ''}</strong> per round. Golf in the plan so far: <strong>{money(perPerson)}</strong> per person.</Callout>
      <div className="section-head"><h2>Rounds</h2><button className="btn small" onClick={() => roundSheet(ctx)}>{Icon.plus} Round</button></div>
      <p className="sub">Anyone can suggest a course and tee time. Vote on each one, and the organizer adds the winners to the plan.</p>
      {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
        const rs = rounds.filter((r) => r.data.day === d).sort((a, b) => Number(b.locked) - Number(a.locked) || teeMinutes(a.data.time) - teeMinutes(b.data.time));
        const planned = plan.filter((r) => r.data.day === d).length;
        return (
          <section className="section" key={d}>
            <div className="day-label">Day {d}{date ? ` · ${dayLabel(date.data.start, d)}` : ''}{planned >= 2 && <Chip kind="plain">36 holes</Chip>}{wx.data && <DayWeather day={wx.data.days[d - 1]} mode={wx.data.mode} />}</div>
            {rs.length === 0
              ? <button className="card empty dashed" onClick={() => roundSheet(ctx, undefined, d)}>{d === 1 ? 'Arrival day' : d === days ? 'Travel home day' : 'Open day'}: suggest a round</button>
              : rs.map((r) => <RoundCard key={r.id} r={r} first={d === 1} />)}
          </section>
        );
      })}
      {wx.data && <WeatherCredit />}
      {destOpt
        ? <CoursesNearby dest={destOpt.data.name} />
        : <p className="hint">Pick a destination on the Trip tab to see golf courses nearby.</p>}
    </>
  );
}

function RoundCard({ r, first }: { r: Option<RoundData>; first: boolean }) {
  const ctx = useTrip();
  const { state, me, act } = ctx;
  const dest = pickOf<DestinationData>(state, 'destination').option;
  const t = tally(state, r.id);
  const ap = (r.data.time.match(/AM|PM/i) || [''])[0].toUpperCase();
  const early = first && teeMinutes(r.data.time) < 13 * 60;
  const search = `https://www.google.com/search?q=${encodeURIComponent(`${r.data.course} ${dest?.data.name || ''} tee times`)}`;
  return (
    <div className={`card opt ${r.locked ? 'locked' : ''}`}>
      <div className="round">
        <div className="tee">{r.data.time.replace(/\s*(AM|PM)/i, '')}<small>{ap}</small></div>
        <div style={{ minWidth: 0 }}>
          <div className="row-title">{r.data.course}</div>
          <div className="row-meta">{r.data.checked ? `Price checked ${r.data.checked}` : 'Price not checked'}{typeof r.data.weekday === 'number' && r.data.weekday >= 0 ? ` · ${isWeekendDay(r.data.weekday) ? 'weekend' : 'weekday'} rate` : ''}</div>
        </div>
        <div className="fee">{money(r.data.fee)}<small>per player</small></div>
      </div>
      <div className="tally" style={{ gap: 6 }}>
        {r.locked ? <Chip kind="good">In the plan</Chip> : t.yes > state.members.length / 2 ? <Chip kind="flag">Most are in</Chip> : null}
        {r.locked && (r.data.booked ? <Chip kind="good">Booked</Chip> : <Chip kind="warn">Not booked</Chip>)}
      </div>
      {r.locked && <Pairings r={r} />}
      {early && <Callout kind="warn">This is an early round on arrival day. Check the Flights tab to see if everyone lands in time.</Callout>}
      {!r.locked && <VoteControl option={r} />}
      <Tally option={r} />
      <div className="opt-foot">
        <a className="btn small" href={r.data.url || search} target="_blank" rel="noopener noreferrer">{r.data.url ? 'Book on course site' : 'Find tee times'}</a>
        <LockButton option={r} lockLabel="Add to plan" unlockLabel="Take out of plan" />
        {me?.is_organizer && r.locked && (
          <button className="btn small ghost" onClick={() => act('update_option', { optionId: r.id, data: { ...r.data, booked: !r.data.booked } })}>{r.data.booked ? 'Mark not booked' : 'Mark booked'}</button>
        )}
        {canEdit(me, r) && <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => roundSheet(ctx, r)}>Edit</button>}
      </div>
    </div>
  );
}

/** Who plays with whom in a planned round. */
function Pairings({ r }: { r: Option<RoundData> }) {
  const ctx = useTrip();
  const { state, me } = ctx;
  if (state.members.length < 2) return null;
  const names = groupNames(state, r.data.groups);
  return (
    <div className="pairings">
      {names.length
        ? names.map((g, i) => <div className="row-meta" key={i}><strong>{teeAfter(r.data.time, i)}</strong> · {g}</div>)
        : <div className="row-meta">No pairings yet{state.members.length > 4 ? `: ${teeTimesNeeded(state.members.length)} groups needed` : ''}.</div>}
      {me?.is_organizer && <button className="link-btn" onClick={() => pairingsSheet(ctx, r)}>{names.length ? 'Change pairings' : 'Set pairings'}</button>}
    </div>
  );
}
