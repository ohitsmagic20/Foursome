'use client';

import { useEffect, useState } from 'react';
import type { CoursePrices, DateData, DestinationData, LodgingData, Option, RoundData, TripState } from '@/lib/shared';
import { ACCESS_LABEL, type CourseAccess } from '@/lib/shared';
import { TeeStats } from '../TeeTable';
import { bookingOpens, dayLabel, groupNames, inPlace, teeAfter, money, optionsOf, pickOf, plannedRounds, tally, teeMinutes, teeTimesNeeded, tripNights } from '@/lib/shared';
import { BookButton, BookingTag, Callout, Chip, Fold, Icon, LockButton, DriveLine, MoreMenu, Tally, Tier, VoteControl, bookingItems, canEdit, useTrip, type TripCtx } from '../ui';
import { pairingsSheet, roundSheet } from '../sheets';
import { CoursesNearby, DayWeather, WeatherCredit, useWeather } from '../live';
import { TripMap, useTripCourses, type MapCourse, type Stop } from '../TripMap';
import { TEMPLATES, templateBySlug } from '@/data/templates';
import { destAirports } from '@/lib/shared';
import { firstName } from '@/lib/client';
import { driveLabel, legOf, useDriveTable } from '../drive';

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
  const where = destOpt ? destOpt.data.name.split(',')[0] : '';
  const wx = useWeather(destOpt?.data.name, date?.data.start, tripNights(state));
  const perPerson = plan.reduce((s, r) => s + (Number(r.data.fee) || 0), 0);
  const unpriced = (plan.length ? plan : rounds).filter((r) => !Number(r.data.fee)).length;
  // Every round's course, looked up once for the map and the cards.
  const stopOf = (r: Option<RoundData>, label: string): Stop => ({
    name: r.data.course, label, courseId: r.data.courseId, day: r.data.day,
    search: r.data.fromTemplate ? templateBySlug(r.data.fromTemplate)?.rounds.find((x) => x.course === r.data.course)?.mapAs : undefined,
  });
  const byTime = (a: Option<RoundData>, b: Option<RoundData>) => a.data.day - b.data.day || teeMinutes(a.data.time) - teeMinutes(b.data.time);
  const airport = destOpt ? destAirports(destOpt.data)[0] : undefined;
  const all = useTripCourses(destOpt?.data.name, airport, rounds.slice().sort(byTime).map((r) => stopOf(r, '')));
  const infoFor = (r: Option<RoundData>) => all.data?.courses.find((c) => c.name === r.data.course);
  const known = useKnownPrices(rounds);
  // Where the group sleeps, as a house pin on the course map.
  const stay = pickOf<LodgingData>(state, 'lodging', ctx.place).option;
  // Each round's drive, the way the day goes: the day's first round from the stay, a second (36 holes)
  // from the morning's course. Built from the same rounds as the map: the plan, else every suggestion.
  const stayPt = stay?.data.lat && stay.data.lon ? { lat: stay.data.lat, lon: stay.data.lon } : null;
  const courseList = all.data?.courses || [];
  const at = (r: Option<RoundData>) => courseList.find((c) => c.name === r.data.course);
  const seq = (plan.length ? plan : rounds).slice().sort(byTime);
  const chain = new Map<string, { from: { lat: number; lon: number }; to: { lat: number; lon: number }; fromName: string | null }>();
  seq.forEach((r, i) => {
    const to = at(r);
    if (!to) return;
    const prev = i > 0 && seq[i - 1].data.day === r.data.day ? seq[i - 1] : null;
    const prevAt = prev ? at(prev) : null;
    if (prev && prevAt) chain.set(r.id, { from: prevAt, to, fromName: prev.data.course });
    else if (stayPt) chain.set(r.id, { from: stayPt, to, fromName: null });
  });
  const chainList = [...chain.entries()];
  const drives = useDriveTable(chainList.map(([, c]) => c.from), chainList.map(([, c]) => c.to));
  const stayShort = stay ? stay.data.name.split(/[,(·]/)[0].trim() : '';
  const fromStay = (r: Option<RoundData>) => {
    const k = chainList.findIndex(([id]) => id === r.id);
    if (k < 0) return undefined;
    const c = chainList[k][1];
    if (c.fromName && c.fromName === r.data.course) return 'Same course, second round';
    const l = legOf(drives, k, k, c.from, c.to);
    const course = c.fromName ? c.fromName.split('(')[0].trim() : '';
    const from = c.fromName ? (course.length <= 20 ? course : 'the morning course') : stayShort.length <= 14 ? stayShort : 'the stay';
    return `${l.est ? '~' : ''}${driveLabel(l.min)} from ${from}`;
  };

  return (
    <>
      <Callout><strong>{teeTimesNeeded(n)} tee time{teeTimesNeeded(n) > 1 ? 's' : ''}</strong> per round · <strong>{money(perPerson)}</strong> per person so far{unpriced ? ` · ${unpriced} round${unpriced === 1 ? '' : 's'} without a price yet` : ''}</Callout>
      {destOpt && rounds.length > 0 && !all.failed && (
        <TripMap place={destOpt.data.name} airport={airport} data={all.data} stops={(plan.length ? plan : rounds).slice().sort(byTime).map((r, i) => stopOf(r, String(i + 1)))}
          homes={stay?.data.lat && stay.data.lon ? [{ label: '', name: stay.data.name, lat: stay.data.lat, lon: stay.data.lon }] : []} />
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
              : rs.map((r) => <RoundCard key={r.id} r={r} first={d === 1} info={infoFor(r)} known={known[r.data.course]} drive={fromStay(r)} />)}
          </section>
        );
      })}
      {rounds.some((r) => r.data.day > days) && (
        <section className="section">
          <div className="day-label">Outside the current dates</div>
          <Callout kind="warn">These fall after the trip ends. Move or remove them.</Callout>
          {rounds.filter((r) => r.data.day > days).map((r) => <RoundCard key={r.id} r={r} first={false} info={infoFor(r)} known={known[r.data.course]} drive={fromStay(r)} />)}
        </section>
      )}
      {wx.data && <WeatherCredit />}
      {/* Finding more courses: folded away so the rounds stay near the top. */}
      <IdeaRounds />
      {destOpt
        ? <Fold title={`Find courses near ${where || destOpt.data.name.split(',')[0]}`} meta="Nearby courses with prices, ratings and type" icon={Icon.golf}><CoursesNearby dest={destOpt.data.name} bare /></Fold>
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
    <Fold title={`Courses from our ${idea.name} trip idea`} meta={`${missing.length} courses not in the vote yet`} icon={Icon.trip}>
      <div className="list">
        {missing.map((r) => (
          <div className="row" key={r.course}>
            <div className="grow"><div className="row-title">{r.course}</div><div className="row-meta">Day {r.day} · {r.time}</div></div>
            <span className="row-meta"><Tier fee={(r.fee.low + r.fee.high) / 2} inline />{r.fee.low === r.fee.high ? money(r.fee.low) : `${money(r.fee.low)}–${r.fee.high}`}</span>
          </div>
        ))}
      </div>
      <div className="btn-row">
        <button className="btn primary" onClick={async () => { if (await act('add_idea_rounds', { slug: idea.slug, dest: place.id })) toast(`Added ${missing.length} rounds to the vote`); }}>Add all {missing.length} to the vote</button>
        <a className="btn" href={`/ideas/${idea.slug}`} target="_blank" rel="noopener noreferrer">See the trip idea</a>
      </div>
    </Fold>
  );
}

function RoundCard({ r, first, info, known, drive }: { r: Option<RoundData>; first: boolean; info?: MapCourse; known?: CoursePrices; drive?: string }) {
  const ctx = useTrip();
  const { state, me } = ctx;
  const dest = viewedPlace(state, ctx.place);
  const t = tally(state, r.id);
  const ap = (r.data.time.match(/AM|PM/i) || [''])[0].toUpperCase();
  const early = first && teeMinutes(r.data.time) < 13 * 60;
  const search = `https://www.google.com/search?q=${encodeURIComponent(`${r.data.course} ${dest?.data.name || ''} tee times`)}`;
  const access = (info?.access || r.data.access || '') as CourseAccess;
  const where = info?.city ? `${info.city}, ${info.state}` : r.data.where || '';
  const url = r.data.url || info?.website || '';
  const organizer = !!me?.is_organizer;
  const pairs = groupNames(state, r.data.groups);
  const hasNotes = !!(r.data.notes || r.data.bookBy);
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
          {drive && <DriveLine text={drive} />}
        </div>
        <RoundFee r={r} known={known} />
      </div>
      {info?.tees?.length ? <TeeStats tees={info.tees} /> : null}
      {(r.locked || t.yes > state.members.length / 2) && (
        <div className="opt-status">
          {r.locked ? <span className="good">In the plan</span> : <span className="flag">Most are in</span>}
          {r.locked && <BookingTag option={r} />}
        </div>
      )}
      {r.locked && pairs.length > 0 && (
        <div className="pairings">{pairs.map((g, i) => <div className="row-meta" key={i}><strong>{teeAfter(r.data.time, i)}</strong> · {g}</div>)}</div>
      )}
      {early && <Callout kind="warn">Early on arrival day. Check everyone lands in time.</Callout>}
      {hasNotes && <RoundNotes r={r} />}
      {!r.locked && <VoteControl option={r} />}
      {!r.locked && <Tally option={r} />}
      <div className="opt-foot">
        {r.locked && <BookButton option={r} />}
        {!r.locked && <LockButton option={r} lockLabel="Add to plan" />}
        <a className="btn small" href={url || search} target="_blank" rel="noopener noreferrer">{r.locked && !r.data.booked ? 'Book tee time ↗' : url ? 'Course site' : 'Tee times'}</a>
        <span style={{ marginLeft: 'auto' }} />
        <MoreMenu items={[
          r.locked && organizer && state.members.length > 1 && { label: pairs.length ? 'Change pairings' : 'Set pairings', onClick: () => pairingsSheet(ctx, r) },
          ...bookingItems(ctx, r),
          { label: hasNotes ? 'Edit note or reminder' : 'Add a note or booking reminder', onClick: () => notesSheet(ctx, r) },
          canEdit(me, r) && { label: 'Edit round', onClick: () => roundSheet(ctx, r) },
          r.locked && organizer && { label: 'Remove from plan', onClick: () => ctx.act('unlock', { optionId: r.id }) },
        ]} />
      </div>
    </div>
  );
}


/** Notes on a round and, if set, when its tee times open, with who gets reminded. */
function RoundNotes({ r }: { r: Option<RoundData> }) {
  const ctx = useTrip();
  const { state } = ctx;
  const open = bookingOpens(state, r);
  const has = !!(r.data.notes || r.data.bookBy);
  if (!has) {
    return <button type="button" className="note-add" onClick={() => notesSheet(ctx, r)}>{Icon.edit}<span>Add a note or a booking reminder</span></button>;
  }
  const owner = state.members.find((m) => m.id === r.data.owner);
  const meOrg = state.members.find((m) => m.id === state.meId)?.is_organizer;
  // Reminders go to whoever is booking it; with nobody assigned, the organizer and whoever set the reminder.
  const who = owner ? (owner.id === state.meId ? 'you' : firstName(owner.name)) : meOrg || r.data.bookBy?.by === state.meId ? 'you' : 'the organizer';
  return (
    <button type="button" className="round-notes" onClick={() => notesSheet(ctx, r)} aria-label="Edit notes and reminder">
      {open && (
        <span className={`remind-line${r.data.booked ? ' done' : open.daysAway <= 1 && open.daysAway >= 0 ? ' soon' : ''}`}>
          <span className="remind-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="7" /><path d="M12 10v3l2 2M5 4 3 6M19 4l2 2" /></svg></span>
          <span>
            {r.data.booked ? <>Booked. Tee times opened {open.label}</>
              : open.daysAway < 0 ? <>Tee times opened {open.label}{open.at ? ` at ${open.at}` : ''}. Not booked yet</>
              : <><b>Tee times open {open.daysAway === 0 ? 'today' : open.daysAway === 1 ? 'tomorrow' : open.label}{open.at ? ` at ${open.at}` : ''}</b> · {open.days} day{open.days === 1 ? '' : 's'} ahead</>}
            {!r.data.booked && open.daysAway >= 0 && <small>{open.locked ? `We’ll remind ${who} the day before and that morning` : 'Reminders start once the dates are locked'}</small>}
          </span>
        </span>
      )}
      {!open && r.data.bookBy && <span className="remind-line"><span>Tee times open {r.data.bookBy.days} days ahead<small>Set the trip dates to get a reminder date</small></span></span>}
      {r.data.notes && <span className="note-text">{r.data.notes}</span>}
    </button>
  );
}

function NotesForm({ ctx, r }: { ctx: TripCtx; r: Option<RoundData> }) {
  const [notes, setNotes] = useState(r.data.notes || '');
  const [on, setOn] = useState(!!r.data.bookBy);
  const [days, setDays] = useState(String(r.data.bookBy?.days ?? 7));
  const [at, setAt] = useState(r.data.bookBy?.at || '');
  const [busy, setBusy] = useState(false);
  const preview = on && Number(days) >= 0 ? bookingOpens(ctx.state, { ...r, data: { ...r.data, bookBy: { days: Number(days), at } } }) : null;
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      const ok = await ctx.act('round_note', { optionId: r.id, notes, bookBy: on ? { days: Number(days), at } : null });
      setBusy(false); if (ok) { ctx.sheet(null); ctx.toast(on ? 'Saved. Reminder set.' : 'Saved'); }
    }}>
      <div className="field">
        <label htmlFor="rn-notes">Notes for the group</label>
        <textarea id="rn-notes" rows={3} maxLength={600} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Call the pro shop, not online. Ask for the twilight rate. Carts required…" />
      </div>
      <div className={`thirtysix${on ? ' on' : ''}`}>
        <label className="check-row"><input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} /> Remind us when tee times open</label>
        {on && (
          <>
            <div className="field">
              <label htmlFor="rn-days">They take bookings this many days ahead</label>
              <div className="days-row">
                <input id="rn-days" type="number" inputMode="numeric" min={0} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
                {[7, 14, 30, 60, 90].map((d) => <button key={d} type="button" className="chip-btn" aria-pressed={Number(days) === d} onClick={() => setDays(String(d))}>{d}</button>)}
              </div>
            </div>
            <div className="field">
              <label htmlFor="rn-at">Opens at (optional, the course’s local time)</label>
              <input id="rn-at" value={at} onChange={(e) => setAt(e.target.value)} placeholder="7:00 AM" autoComplete="off" />
            </div>
            <p className="hint">
              {preview ? <>Opens <b>{preview.label}{preview.at ? ` at ${preview.at}` : ''}</b>{preview.daysAway < 0 ? ', which has already passed.' : '.'} </> : 'Set the trip dates and the date is worked out for you. '}
              Whoever is booking this round (or the organizer) gets a push and email the morning before and that morning, and it’s in the trip calendar with an alert.
            </p>
          </>
        )}
      </div>
      <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Save'}</button>
    </form>
  );
}
function notesSheet(ctx: TripCtx, r: Option<RoundData>) { ctx.sheet({ title: `Notes · ${r.data.course}`, body: <NotesForm ctx={ctx} r={r} /> }); }

/** The greens fee with its $/$$/$$$ tier. With no price entered: what other groups paid, if known, or "Price TBD". */
function RoundFee({ r, known }: { r: Option<RoundData>; known?: CoursePrices }) {
  const entered = Number(r.data.fee) || 0;
  const guess = !entered && known?.all ? known.all.median : 0;
  const fee = entered || guess;
  if (!fee) return <div className="fee tbd">TBD<small>price</small></div>;
  const note = guess ? (known?.source === 'idea' ? 'typical' : 'groups paid')
    : r.data.estimate ? (r.data.checked === 'trip idea' ? 'typical' : 'est., groups paid')
    : r.data.fromTemplate ? 'typical' : r.data.checked ? `as of ${r.data.checked.replace(/,\s*\d{4}$/, '')}` : 'per player';
  return (
    <div className="fee">
      <Tier fee={fee} />
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

