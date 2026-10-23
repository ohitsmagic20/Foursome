'use client';

import type { DateData, DestinationData, Option, RoundData } from '@/lib/shared';
import { ACCESS_LABEL, teeSummary, type CourseAccess } from '@/lib/shared';
import { dayLabel, groupNames, teeAfter, money, optionsOf, pickOf, plannedRounds, tally, teeMinutes, teeTimesNeeded, tripNights } from '@/lib/shared';
import { BookingRow, Callout, Chip, Icon, LockButton, Tally, VoteControl, canEdit, useTrip } from '../ui';
import { pairingsSheet, roundSheet } from '../sheets';
import { CoursesNearby, DayWeather, WeatherCredit, useWeather } from '../live';
import { TripMap, useTripCourses, type MapCourse, type Stop } from '../TripMap';
import { CourseAbout } from '../CourseAbout';
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
  // Every round's course, looked up once for the map and the cards.
  const stopOf = (r: Option<RoundData>, label: string): Stop => ({
    name: r.data.course, label, courseId: r.data.courseId,
    search: r.data.fromTemplate ? templateBySlug(r.data.fromTemplate)?.rounds.find((x) => x.course === r.data.course)?.mapAs : undefined,
  });
  const byTime = (a: Option<RoundData>, b: Option<RoundData>) => a.data.day - b.data.day || teeMinutes(a.data.time) - teeMinutes(b.data.time);
  const airport = destOpt ? destAirports(destOpt.data)[0] : undefined;
  const all = useTripCourses(destOpt?.data.name, airport, rounds.slice().sort(byTime).map((r) => stopOf(r, '')));
  const infoFor = (r: Option<RoundData>) => all.data?.courses.find((c) => c.name === r.data.course);

  return (
    <>
      <Callout><strong>{teeTimesNeeded(n)} tee time{teeTimesNeeded(n) > 1 ? 's' : ''}</strong> per round · <strong>{money(perPerson)}</strong> per person so far</Callout>
      {destOpt && rounds.length > 0 && !all.failed && (
        <TripMap place={destOpt.data.name} airport={airport} data={all.data} stops={(plan.length ? plan : rounds).slice().sort(byTime).map((r, i) => stopOf(r, String(i + 1)))} />
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
              : rs.map((r) => <RoundCard key={r.id} r={r} first={d === 1} info={infoFor(r)} />)}
          </section>
        );
      })}
      {rounds.some((r) => r.data.day > days) && (
        <section className="section">
          <div className="day-label">Outside the current dates</div>
          <Callout kind="warn">These fall after the trip ends. Move or remove them.</Callout>
          {rounds.filter((r) => r.data.day > days).map((r) => <RoundCard key={r.id} r={r} first={false} info={infoFor(r)} />)}
        </section>
      )}
      {wx.data && <WeatherCredit />}
      {destOpt
        ? <CoursesNearby dest={destOpt.data.name} />
        : <p className="hint">Pick a destination to see courses nearby.</p>}
    </>
  );
}

function RoundCard({ r, first, info }: { r: Option<RoundData>; first: boolean; info?: MapCourse }) {
  const ctx = useTrip();
  const { state, me } = ctx;
  const dest = pickOf<DestinationData>(state, 'destination').option;
  const t = tally(state, r.id);
  const ap = (r.data.time.match(/AM|PM/i) || [''])[0].toUpperCase();
  const early = first && teeMinutes(r.data.time) < 13 * 60;
  const search = `https://www.google.com/search?q=${encodeURIComponent(`${r.data.course} ${dest?.data.name || ''} tee times`)}`;
  const access = (info?.access || r.data.access || '') as CourseAccess;
  const where = info?.city ? `${info.city}, ${info.state}` : r.data.where || '';
  // 18Birdies and The Grint have no public data access, so link to their reviews instead.
  const reviews = `https://www.google.com/search?q=${encodeURIComponent(`${r.data.course} ${where || dest?.data.name || ''} reviews 18Birdies OR TheGrint`)}`;
  const url = r.data.url || info?.website || '';
  return (
    <div className={`card opt ${r.locked ? 'locked' : ''}`}>
      <div className="round">
        <div className="tee">{r.data.time.replace(/\s*(AM|PM)/i, '')}<small>{ap}</small></div>
        <div style={{ minWidth: 0 }}>
          <div className="row-title">{r.data.course}</div>
          {(access || where) && (
            <div className="row-meta">
              {access && <span className={`access ${access}`}>{ACCESS_LABEL[access]}</span>}
              {where}
            </div>
          )}
          {(info?.par || info?.tees?.length) ? (
            <div className="row-meta">
              {[info.par ? `Par ${info.par}` : '', teeSummary(info.tees || [])].filter(Boolean).join(' · ')}
              {' · '}<a href={reviews} target="_blank" rel="noopener noreferrer">Reviews</a>
            </div>
          ) : <div className="row-meta"><a href={reviews} target="_blank" rel="noopener noreferrer">Reviews</a></div>}
          {info && <CourseAbout info={info} />}
        </div>
        <div className="fee">{money(r.data.fee)}<small>{r.data.fromTemplate ? 'typical' : r.data.checked ? `as of ${r.data.checked.replace(/,\s*\d{4}$/, '')}` : 'per player'}</small></div>
      </div>
      {r.locked
        ? <div className="opt-status"><span className="good">In the plan</span></div>
        : t.yes > state.members.length / 2 ? <div className="opt-status"><span className="flag">Most are in</span></div> : null}
      {r.locked && <Pairings r={r} />}
      {r.locked && <BookingRow option={r} />}
      {early && <Callout kind="warn">Early on arrival day. Check everyone lands in time.</Callout>}
      {!r.locked && <VoteControl option={r} />}
      <Tally option={r} />
      <div className="opt-foot">
        <a className="btn small" href={url || search} target="_blank" rel="noopener noreferrer">{url ? 'Course site' : 'Tee times'}</a>
        <LockButton option={r} lockLabel="Add to plan" unlockLabel="Remove from plan" />
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
