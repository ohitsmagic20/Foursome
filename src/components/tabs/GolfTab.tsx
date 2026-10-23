'use client';

import type { DateData, DestinationData, Option, RoundData } from '@/lib/shared';
import { dayLabel, groupNames, isWeekendDay, teeAfter, money, optionsOf, pickOf, plannedRounds, tally, teeMinutes, teeTimesNeeded, tripNights } from '@/lib/shared';
import { Callout, Chip, Icon, LockButton, Tally, VoteControl, canEdit, useTrip } from '../ui';
import { pairingsSheet, roundSheet } from '../sheets';
import { CoursesNearby, DayWeather, WeatherCredit, useWeather } from '../live';
import { TripMap } from '../TripMap';
import { templateBySlug } from '@/data/templates';
import { destAirports } from '@/lib/shared';

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
      <Callout><strong>{teeTimesNeeded(n)} tee time{teeTimesNeeded(n) > 1 ? 's' : ''}</strong> per round · <strong>{money(perPerson)}</strong> per person so far</Callout>
      {destOpt && rounds.length > 0 && (
        <TripMap
          place={destOpt.data.name}
          airport={destAirports(destOpt.data)[0]}
          stops={(plan.length ? plan : rounds).slice().sort((a, b) => a.data.day - b.data.day || teeMinutes(a.data.time) - teeMinutes(b.data.time)).map((r, i) => ({ name: r.data.course, label: String(i + 1), search: r.data.fromTemplate ? templateBySlug(r.data.fromTemplate)?.rounds.find((x) => x.course === r.data.course)?.mapAs : undefined }))}
        />
      )}
      <div className="section-head"><h2>Rounds</h2><button className="btn small" onClick={() => roundSheet(ctx)}>{Icon.plus} Round</button></div>
      <p className="sub">Suggest a round, vote, and the organizer adds the winners.</p>
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
      {rounds.some((r) => r.data.day > days) && (
        <section className="section">
          <div className="day-label">Outside the current dates</div>
          <Callout kind="warn">These fall after the trip ends. Move or remove them.</Callout>
          {rounds.filter((r) => r.data.day > days).map((r) => <RoundCard key={r.id} r={r} first={false} />)}
        </section>
      )}
      {wx.data && <WeatherCredit />}
      {destOpt
        ? <CoursesNearby dest={destOpt.data.name} />
        : <p className="hint">Pick a destination to see courses nearby.</p>}
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
          <div className="row-meta">{r.data.fromTemplate ? 'Typical price' : r.data.checked ? `Price checked ${r.data.checked}` : 'Price not checked'}{typeof r.data.weekday === 'number' && r.data.weekday >= 0 ? ` · ${isWeekendDay(r.data.weekday) ? 'weekend' : 'weekday'} rate` : ''}</div>
        </div>
        <div className="fee">{money(r.data.fee)}<small>per player</small></div>
      </div>
      {r.locked
        ? <div className="opt-status"><span className="good">In the plan</span><span className={r.data.booked ? 'good' : 'warn'}>{r.data.booked ? 'Booked' : 'Not booked'}</span></div>
        : t.yes > state.members.length / 2 ? <div className="opt-status"><span className="flag">Most are in</span></div> : null}
      {r.locked && <Pairings r={r} />}
      {early && <Callout kind="warn">Early on arrival day. Check everyone lands in time.</Callout>}
      {!r.locked && <VoteControl option={r} />}
      <Tally option={r} />
      <div className="opt-foot">
        <a className="btn small" href={r.data.url || search} target="_blank" rel="noopener noreferrer">Tee times</a>
        <LockButton option={r} lockLabel="Add to plan" unlockLabel="Remove from plan" />
        {me?.is_organizer && r.locked && (
          <button className="btn small ghost" onClick={() => act('update_option', { optionId: r.id, data: { ...r.data, booked: !r.data.booked } })}>{r.data.booked ? 'Not booked' : 'Booked it'}</button>
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
  if (!names.length && !me?.is_organizer) return null;
  return (
    <div className="pairings">
      {names.map((g, i) => <div className="row-meta" key={i}><strong>{teeAfter(r.data.time, i)}</strong> · {g}</div>)}
      {me?.is_organizer && <button className="link-btn" onClick={() => pairingsSheet(ctx, r)}>{names.length ? 'Change pairings' : 'Set pairings'}</button>}
    </div>
  );
}
