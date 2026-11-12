'use client';

import { useEffect, useState } from 'react';
import type { CoursePrices, DateData, DestinationData, LodgingData, Option, RoundData, TripState } from '@/lib/shared';
import { ACCESS_LABEL, TIER_HINT, priceTier, type CourseAccess } from '@/lib/shared';
import { TeeStats } from '../TeeTable';
import { dayLabel, groupNames, inPlace, teeAfter, money, optionsOf, pickOf, plannedRounds, tally, teeMinutes, teeTimesNeeded, tripNights } from '@/lib/shared';
import { PlaceSwitcher, usePlaces } from '../Places';
import { BookingRow, Callout, Chip, Icon, LockButton, Tally, VoteControl, canEdit, useTrip } from '../ui';
import { pairingsSheet, roundSheet } from '../sheets';
import { CoursesNearby, DayWeather, WeatherCredit, useWeather } from '../live';
import { CupLink } from '../Cup';
import { TripMap, useTripCourses, type MapCourse, type Stop } from '../TripMap';
import { TEMPLATES, templateBySlug } from '@/data/templates';
import { destAirports } from '@/lib/shared';

/** The destination being planned on this tab (the locked one, or the one picked in the switcher). */
const viewedPlace = (state: TripState, id: string | null) => (optionsOf<DestinationData>(state, 'destination').find((d) => d.id === id) || null) as Option<DestinationData> | null;

export function GolfTab() {
  const ctx = useTrip();
  const { state } = ctx;
  const n = state.members.length;
  const days = tripNights(state) + 1;
  const date = pickOf<DateData>(state, 'date').option;
  const rounds = inPlace<RoundData>(state, 'round', ctx.place);
  const plan = plannedRounds(state, ctx.place);
  const destOpt = viewedPlace(state, ctx.place);
  const choosing = usePlaces().length > 1;
  const where = destOpt ? destOpt.data.name.split(',')[0] : '';
  const wx = useWeather(destOpt?.data.name, date?.data.start, tripNights(state));
  const perPerson = plan.reduce((s, r) => s + (Number(r.data.fee) || 0), 0);
  const unpriced = (plan.length ? plan : rounds).filter((r) => !Number(r.data.fee)).length;
  // Every round's course, looked up once for the map and the cards.
  const stopOf = (r: Option<RoundData>, label: string): Stop => ({
    name: r.data.course, label, courseId: r.data.courseId,
    search: r.data.fromTemplate ? templateBySlug(r.data.fromTemplate)?.rounds.find((x) => x.course === r.data.course)?.mapAs : undefined,
  });
  const byTime = (a: Option<RoundData>, b: Option<RoundData>) => a.data.day - b.data.day || teeMinutes(a.data.time) - teeMinutes(b.data.time);
  const airport = destOpt ? destAirports(destOpt.data)[0] : undefined;
  const all = useTripCourses(destOpt?.data.name, airport, rounds.slice().sort(byTime).map((r) => stopOf(r, '')));
  const infoFor = (r: Option<RoundData>) => all.data?.courses.find((c) => c.name === r.data.course);
  const known = useKnownPrices(rounds);
  // Where the group sleeps, as a house pin on the course map.
  const stay = pickOf<LodgingData>(state, 'lodging', ctx.place).option;

  return (
    <>
      <PlaceSwitcher kind="round" />
      <Callout>{choosing && where ? <>{where}: </> : null}<strong>{teeTimesNeeded(n)} tee time{teeTimesNeeded(n) > 1 ? 's' : ''}</strong> per round · <strong>{money(perPerson)}</strong> per person so far{unpriced ? ` · ${unpriced} round${unpriced === 1 ? '' : 's'} without a price yet` : ''}</Callout>
      {!choosing && <CupLink />}
      {destOpt && rounds.length > 0 && !all.failed && (
        <TripMap place={destOpt.data.name} airport={airport} data={all.data} stops={(plan.length ? plan : rounds).slice().sort(byTime).map((r, i) => stopOf(r, String(i + 1)))}
          homes={stay?.data.lat && stay.data.lon ? [{ label: '', name: stay.data.name, lat: stay.data.lat, lon: stay.data.lon }] : []} />
      )}
      <div className="section-head"><h2>{choosing && where ? `Rounds in ${where}` : 'Rounds'}</h2><button className="btn small" onClick={() => roundSheet(ctx)}>{Icon.plus} Round</button></div>
      <p className="sub">Suggest a round, vote, and the organizer adds the winners.</p>
      <IdeaRounds />
      {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
        const rs = rounds.filter((r) => r.data.day === d).sort((a, b) => Number(b.locked) - Number(a.locked) || teeMinutes(a.data.time) - teeMinutes(b.data.time));
        const planned = plan.filter((r) => r.data.day === d).length;
        return (
          <section className="section" key={d}>
            <div className="day-label">Day {d}{date ? ` · ${dayLabel(date.data.start, d)}` : ''}{planned >= 2 && <Chip kind="plain">36 holes</Chip>}{wx.data && <DayWeather day={wx.data.days[d - 1]} mode={wx.data.mode} />}</div>
            {rs.length === 0
              ? <button className="card empty dashed" onClick={() => roundSheet(ctx, undefined, d)}>{d === 1 ? 'Arrival day' : d === days ? 'Travel home day' : 'Open day'}: suggest a round</button>
              : rs.map((r) => <RoundCard key={r.id} r={r} first={d === 1} info={infoFor(r)} known={known[r.data.course]} />)}
          </section>
        );
      })}
      {rounds.some((r) => r.data.day > days) && (
        <section className="section">
          <div className="day-label">Outside the current dates</div>
          <Callout kind="warn">These fall after the trip ends. Move or remove them.</Callout>
          {rounds.filter((r) => r.data.day > days).map((r) => <RoundCard key={r.id} r={r} first={false} info={infoFor(r)} known={known[r.data.course]} />)}
        </section>
      )}
      {wx.data && <WeatherCredit />}
      {destOpt
        ? <CoursesNearby dest={destOpt.data.name} />
        : <p className="hint">Pick a destination to see courses nearby.</p>}
    </>
  );
}

/** The destination matches one of our trip ideas: offer its courses in one tap. */
function IdeaRounds() {
  const ctx = useTrip();
  const { state, act, toast } = ctx;
  const place = viewedPlace(state, ctx.place);
  if (!place) return null;
  const key = place.data.name.toLowerCase().split(',')[0].trim();
  const idea = TEMPLATES.find((t) => t.destination.toLowerCase().split(',')[0].trim() === key);
  if (!idea) return null;
  const have = new Set(inPlace<RoundData>(state, 'round', place.id).map((r) => r.data.course.toLowerCase()));
  const missing = idea.rounds.filter((r) => !have.has(r.course.toLowerCase()));
  if (missing.length < 2) return null;
  return (
    <div className="card idea-rounds">
      <div className="row-title">Courses from our {idea.name} trip idea</div>
      <div className="list">
        {missing.map((r) => (
          <div className="row" key={r.course}>
            <div className="grow"><div className="row-title">{r.course}</div><div className="row-meta">Day {r.day} · {r.time}</div></div>
            <span className="row-meta">{r.fee.low === r.fee.high ? money(r.fee.low) : `${money(r.fee.low)}–${r.fee.high}`}</span>
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button className="btn primary" onClick={async () => { if (await act('add_idea_rounds', { slug: idea.slug, dest: place.id })) toast(`Added ${missing.length} rounds to the vote`); }}>Add all {missing.length} to the vote</button>
        <a className="btn" href={`/ideas/${idea.slug}`} target="_blank" rel="noopener noreferrer">See the trip idea</a>
      </div>
    </div>
  );
}

function RoundCard({ r, first, info, known }: { r: Option<RoundData>; first: boolean; info?: MapCourse; known?: CoursePrices }) {
  const ctx = useTrip();
  const { state, me } = ctx;
  const dest = viewedPlace(state, ctx.place);
  const plans = usePlaces().length > 1 && dest ? `${dest.data.name.split(',')[0]} plan` : 'plan';
  const t = tally(state, r.id);
  const ap = (r.data.time.match(/AM|PM/i) || [''])[0].toUpperCase();
  const early = first && teeMinutes(r.data.time) < 13 * 60;
  const search = `https://www.google.com/search?q=${encodeURIComponent(`${r.data.course} ${dest?.data.name || ''} tee times`)}`;
  const access = (info?.access || r.data.access || '') as CourseAccess;
  const where = info?.city ? `${info.city}, ${info.state}` : r.data.where || '';
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

        </div>
        <RoundFee r={r} known={known} />
      </div>
      {info?.tees?.length ? <TeeStats tees={info.tees} /> : null}
      {r.locked
        ? <div className="opt-status"><span className="good">In the {plans}</span></div>
        : t.yes > state.members.length / 2 ? <div className="opt-status"><span className="flag">Most are in</span></div> : null}
      {r.locked && <Pairings r={r} />}
      {r.locked && <BookingRow option={r} />}
      {early && <Callout kind="warn">Early on arrival day. Check everyone lands in time.</Callout>}
      {!r.locked && <VoteControl option={r} />}
      <Tally option={r} />
      <div className="opt-foot">
        <a className="btn small" href={url || search} target="_blank" rel="noopener noreferrer">{url ? 'Course site' : 'Tee times'}</a>
        <LockButton option={r} lockLabel={`Add to ${plans}`} unlockLabel="Remove from plan" />
        {canEdit(me, r) && <button className="btn small ghost" style={{ marginLeft: 'auto' }} onClick={() => roundSheet(ctx, r)}>Edit</button>}
      </div>
    </div>
  );
}

/** The greens fee with its $/$$/$$$ tier. With no price entered: what other groups paid, if known, or "Price TBD". */
function RoundFee({ r, known }: { r: Option<RoundData>; known?: CoursePrices }) {
  const entered = Number(r.data.fee) || 0;
  const guess = !entered && known?.all ? known.all.median : 0;
  const fee = entered || guess;
  const tier = priceTier(fee);
  if (!fee) return <div className="fee tbd">TBD<small>price</small></div>;
  const note = guess ? (known?.source === 'idea' ? 'typical' : 'groups paid')
    : r.data.estimate ? (r.data.checked === 'trip idea' ? 'typical' : 'est., groups paid')
    : r.data.fromTemplate ? 'typical' : r.data.checked ? `as of ${r.data.checked.replace(/,\s*\d{4}$/, '')}` : 'per player';
  return (
    <div className="fee">
      {tier && <span className="tier" title={TIER_HINT[tier]} aria-label={TIER_HINT[tier]}><b>{tier}</b>{'$$$'.slice(tier.length)}</span>}
      {guess || r.data.estimate ? '~' : ''}{money(fee)}<small>{note}</small>
    </div>
  );
}

/** Typical prices for rounds that don't have one yet, so even "TBD" rounds show roughly what they cost. */
function useKnownPrices(rounds: Option<RoundData>[]) {
  const names = [...new Set(rounds.filter((r) => !Number(r.data.fee)).map((r) => r.data.course))].sort();
  const key = names.join('|');
  const [map, setMap] = useState<Record<string, CoursePrices>>({});
  useEffect(() => {
    if (!key) return;
    let live = true;
    fetch(`/api/course-prices?courses=${encodeURIComponent(key)}`).then((x) => (x.ok ? x.json() : null)).then((j) => live && j && setMap(j.prices || {})).catch(() => {});
    return () => { live = false; };
  }, [key]);
  return map;
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
