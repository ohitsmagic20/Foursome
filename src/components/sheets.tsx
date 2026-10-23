'use client';

import { useEffect, useRef, useState } from 'react';
import type { DestinationData, LodgingData, Option, RoundData, TripCtx } from './sheetTypes';
import type { CourseHit, CoursePrices, DateData, NearbyAirport, NearbyCourse } from '@/lib/shared';
import { ACCESS_LABEL } from '@/lib/shared';
import { addDays, autoGroups, dayLabel, destAirports, isWeekendDay, parseDay, pickOf, teeAfter, teeTimesNeeded, tripNights } from '@/lib/shared';
import { api, clearToken, getSession, todayLabel } from '@/lib/client';
import { Chip, ConfirmButton, Field, Select, SheetForm, TimeField } from './ui';

async function save(ctx: TripCtx, type: string, payload: Record<string, unknown>, msg: string) {
  if (await ctx.act(type, payload)) {
    ctx.sheet(null);
    ctx.toast(msg);
  }
}
const num = (v: string | undefined) => (v === undefined || v === '' ? 0 : Number(v));

export function tripSheet(ctx: TripCtx) {
  const t = ctx.state.trip;
  ctx.sheet({
    title: 'Trip details',
    body: (
      <>
        <SheetForm submit="Save" onSubmit={(fd) => save(ctx, 'update_trip', { name: fd.name, nights: num(fd.nights), food: num(fd.food) }, 'Trip updated')}>
          <Field name="name" label="Trip name" defaultValue={t.name} required />
          <div className="grid2">
            <Field name="nights" label="Default nights" type="number" defaultValue={t.nights} min={1} max={10} step={1} />
            <Field name="food" label="Food & extras each ($)" type="number" defaultValue={t.food} />
          </div>
        </SheetForm>
        <OrganizerTools ctx={ctx} />
      </>
    ),
  });
}

export function meSheet(ctx: TripCtx) {
  // Signed-in people edit their profile, which updates them on every trip.
  if (getSession()) { location.href = `/profile?back=${encodeURIComponent(location.pathname + location.hash)}`; return; }
  const m = ctx.me!;
  ctx.sheet({
    title: 'Your details',
    body: (
      <SheetForm submit="Save" onSubmit={(fd) => save(ctx, 'update_me', { name: fd.name, airport: fd.airport, budget: num(fd.budget), bed: fd.bed }, 'Saved')}>
        <Field name="name" label="Name" defaultValue={m.name} required />
        <div className="grid2">
          <Field name="airport" label="Home airport" defaultValue={m.airport} placeholder="ORD" autoCapitalize="characters" maxLength={3} />
          <Field name="budget" label="Budget, all-in ($)" type="number" defaultValue={m.budget} />
        </div>
        <Select name="bed" label="Sleeping" defaultValue={m.bed} options={[['own', 'I want my own bed'], ['share', 'I’m fine sharing a bed']]} />
      </SheetForm>
    ),
  });
}

export function dateSheet(ctx: TripCtx) {
  const d = new Date();
  d.setMonth(d.getMonth() + 4);
  const iso = d.toISOString().slice(0, 10);
  ctx.sheet({
    title: 'Suggest dates',
    body: (
      <SheetForm submit="Add to the vote" onSubmit={(fd) => save(ctx, 'add_option', { kind: 'date', data: { start: fd.start, nights: num(fd.nights) } }, 'Dates added to the vote')}>
        <div className="grid2">
          <Field name="start" label="Arrival date" type="date" defaultValue={iso} required />
          <Select name="nights" label="Nights" defaultValue={String(ctx.state.trip.nights)} options={Array.from({ length: 14 }, (_, i) => [String(i + 1), `${i + 1} night${i ? 's' : ''}`] as [string, string])} />
        </div>

      </SheetForm>
    ),
  });
}

function DestinationForm({ ctx, opt }: { ctx: TripCtx; opt?: Option<DestinationData> }) {
  const [name, setName] = useState(opt?.data.name || '');
  const [found, setFound] = useState<NearbyAirport[]>([]);
  const [picked, setPicked] = useState<string[]>(opt ? destAirports(opt.data) : []);
  const [placeLabel, setPlaceLabel] = useState('');
  const [courses, setCourses] = useState<NearbyCourse[] | null>(null);
  const [status, setStatus] = useState<'' | 'looking' | 'notfound'>('');
  const [extra, setExtra] = useState('');
  const touched = useRef(!!opt);
  const lastQuery = useRef('');

  useEffect(() => {
    const q = name.trim();
    if (q.length < 2 || q === lastQuery.current) return;
    const t = setTimeout(async () => {
      lastQuery.current = q;
      setStatus('looking');
      setCourses(null);
      try {
        const r = await api<{ place: string; airports: NearbyAirport[] }>(`/api/airports?place=${encodeURIComponent(q)}`);
        if (lastQuery.current !== q) return;
        setFound(r.airports);
        setPlaceLabel(r.place);
        setStatus('');
        if (!touched.current) setPicked(r.airports.filter((a) => a.suggested).map((a) => a.code));
        api<{ courses: NearbyCourse[] }>(`/api/courses?place=${encodeURIComponent(q)}&miles=30`)
          .then((c) => lastQuery.current === q && setCourses(c.courses.filter((x) => !x.isPrivate)))
          .catch(() => setCourses([]));
      } catch {
        if (lastQuery.current === q) { setFound([]); setStatus('notfound'); }
      }
    }, 600);
    return () => clearTimeout(t);
  }, [name]);

  const toggle = (code: string) => {
    touched.current = true;
    setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code].slice(0, 4)));
  };
  const shown = [...found, ...picked.filter((c) => !found.some((f) => f.code === c)).map((c) => ({ code: c, name: 'Added by hand', city: '', miles: -1, major: false, suggested: false }))];

  return (
    <SheetForm submit={opt ? 'Save' : 'Add to the vote'}
      onSubmit={() => {
        if (!picked.length) throw new Error('Pick at least one airport to fly into.');
        const data = { name: name.trim(), airports: picked };
        return opt ? save(ctx, 'update_option', { optionId: opt.id, data }, 'Saved') : save(ctx, 'add_option', { kind: 'destination', data }, 'Destination added');
      }}
      extra={opt ? <ConfirmButton label="Remove" onConfirm={() => save(ctx, 'delete_option', { optionId: opt.id }, 'Removed')} /> : undefined}>
      <div className="field">
        <label htmlFor="f-name">Destination</label>
        <input id="f-name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Myrtle Beach, SC" required autoComplete="off" />
      </div>
      {status === 'looking' && <p className="hint">Finding airports near {name.trim()}…</p>}
      {status === 'notfound' && <p className="hint">Not found. Try “City, ST”.</p>}
      {shown.length > 0 && (
        <div className="field">
          <label>Fly into {placeLabel && <span style={{ fontWeight: 500 }}>· near {placeLabel}</span>}</label>
          <div className="airport-list">
            {shown.map((a) => (
              <button type="button" key={a.code} className="airport" aria-pressed={picked.includes(a.code)} onClick={() => toggle(a.code)}>
                <span className="code">{a.code}</span>
                <span className="grow" style={{ textAlign: 'left' }}>
                  <span className="row-title" style={{ display: 'block' }}>{a.name}</span>
                  <span className="row-meta">{a.miles >= 0 ? `${a.miles} mi away` : ''}{a.major && a.miles >= 0 ? ' · major airport' : ''}</span>
                </span>
                <span className="check" aria-hidden="true">{picked.includes(a.code) ? '✓' : ''}</span>
              </button>
            ))}
          </div>
          <p className="hint">Pick one or more.</p>
        </div>
      )}
      <div className="field">
        <label htmlFor="f-extra">Another airport code</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input id="f-extra" value={extra} onChange={(e) => setExtra(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))} placeholder="SNA" style={{ flex: 1 }} />
          <button type="button" className="btn" disabled={extra.length !== 3} onClick={() => { toggle(extra); setExtra(''); }}>Add</button>
        </div>
      </div>
      {courses && courses.length > 0 && (
        <div className="callout good" style={{ fontSize: 13 }}>
          <div><strong>{courses.length}{courses.length >= 40 ? '+' : ''} public courses within 30 miles</strong>, including {courses.slice(0, 4).map((c) => c.name).join(', ')}. You’ll see them all on the Golf tab.</div>
        </div>
      )}
      {courses && courses.length === 0 && <p className="hint">No courses within 30 miles.</p>}
    </SheetForm>
  );
}

export function destSheet(ctx: TripCtx, opt?: Option<DestinationData>) {
  ctx.sheet({ title: opt ? 'Edit destination' : 'Suggest a destination', body: <DestinationForm ctx={ctx} opt={opt} /> });
}

function LodgingForm({ ctx, opt }: { ctx: TripCtx; opt?: Option<LodgingData> }) {
  const [url, setUrl] = useState(opt?.data.url || '');
  const [name, setName] = useState(opt?.data.name || '');
  const [image, setImage] = useState(opt?.data.image || '');
  const [looking, setLooking] = useState(false);
  async function lookup(u: string) {
    if (!/^https?:\/\//.test(u)) return;
    setLooking(true);
    try {
      const r = await api<{ title: string; image: string }>('/api/preview', { body: { url: u } });
      if (r.title && !name) setName(r.title);
      if (r.image) setImage(r.image);
    } catch { /* type it in by hand */ } finally { setLooking(false); }
  }
  return (
    <SheetForm submit={opt ? 'Save' : 'Add to the vote'}
      onSubmit={(fd) => {
        const data = { name: fd.name, url: fd.url, image, total: num(fd.total), bedrooms: num(fd.bedrooms), beds: num(fd.beds) };
        return opt ? save(ctx, 'update_option', { optionId: opt.id, data }, 'Saved') : save(ctx, 'add_option', { kind: 'lodging', data }, 'Added to the vote');
      }}
      extra={opt ? <ConfirmButton label="Remove" onConfirm={() => save(ctx, 'delete_option', { optionId: opt.id }, 'Removed')} /> : undefined}>
      <div className="field">
        <label htmlFor="f-url">Listing link (Airbnb, Vrbo, hotel)</label>
        <input id="f-url" name="url" type="url" inputMode="url" placeholder="https://" value={url}
          onChange={(e) => setUrl(e.target.value)} onBlur={() => lookup(url)}
          onPaste={(e) => { const t = e.clipboardData.getData('text'); setTimeout(() => lookup(t), 0); }} />
      </div>
      {looking && <p className="hint">Reading the listing…</p>}
      {image && <img className="opt-img" src={image} alt="" />}
      <div className="field">
        <label htmlFor="f-name">Name</label>
        <input id="f-name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="6-bedroom beach house" />
      </div>
      <Field name="total" label={`Total for ${tripNights(ctx.state)} nights, with fees ($)`} type="number" defaultValue={opt?.data.total || ''} required />
      <div className="grid2">
        <Field name="bedrooms" label="Bedrooms" type="number" defaultValue={opt?.data.bedrooms || ''} />
        <Field name="beds" label="Beds" type="number" defaultValue={opt?.data.beds || ''} />
      </div>
      <p className="hint">Total for your dates, from the listing.</p>
    </SheetForm>
  );
}
export function lodgingSheet(ctx: TripCtx, opt?: Option<LodgingData>) {
  ctx.sheet({ title: opt ? 'Edit place' : 'Suggest a place to stay', body: <LodgingForm ctx={ctx} opt={opt} /> });
}

function RoundForm({ ctx, opt, day: startDay, prefillCourse, prefillUrl }: { ctx: TripCtx; opt?: Option<RoundData>; day: number; prefillCourse?: string; prefillUrl?: string }) {
  const { state } = ctx;
  const days = tripNights(state) + 1;
  const d = opt?.data;
  const date = pickOf<DateData>(state, 'date').option;
  const dest = pickOf<DestinationData>(state, 'destination').option;
  const [course, setCourse] = useState(d?.course ?? prefillCourse ?? '');
  const [url, setUrl] = useState(d?.url ?? prefillUrl ?? '');
  const [day, setDay] = useState(Math.min(d?.day || startDay, days));
  const [fee, setFee] = useState(d?.fee ? String(d.fee) : '');
  const [prices, setPrices] = useState<CoursePrices | null>(null);
  // The course picked from the database (keeps its id, location and type). Typing a new name clears it.
  const [picked, setPicked] = useState<CourseHit | null>(d?.courseId ? { id: d.courseId, name: d.course, city: '', state: '', access: d.access || '', lat: d.lat || 0, lon: d.lon || 0, website: d.url || '' } : null);
  const [hits, setHits] = useState<CourseHit[]>([]);
  const [open, setOpen] = useState(false);

  const weekday = date ? addDays(parseDay(date.data.start), day - 1).getDay() : -1;
  const weekend = weekday >= 0 && isWeekendDay(weekday);
  const dayName = date ? dayLabel(date.data.start, day) : '';

  // Course suggestions from the database, nearest to the destination first.
  useEffect(() => {
    const q = course.trim();
    if (q.length < 3 || (picked && picked.name === q)) { setHits([]); return; }
    const t = setTimeout(() => {
      api<{ courses: CourseHit[] }>(`/api/course-search?q=${encodeURIComponent(q)}${dest ? `&place=${encodeURIComponent(dest.data.name)}` : ''}`)
        .then((r) => {
          setHits(r.courses);
          // Opened from "Suggest" on a nearby course: pick the exact match automatically.
          const same = r.courses.find((h) => h.name.toLowerCase() === q.toLowerCase() && (h.miles ?? 0) < 60);
          if (same && !picked && q === (prefillCourse || '').trim()) { pick(same); }
        })
        .catch(() => setHits([]));
    }, 250);
    return () => clearTimeout(t);
  }, [course]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(h: CourseHit) {
    setPicked(h);
    setCourse(h.name);
    if (h.website && !url) setUrl(h.website);
    setHits([]);
    setOpen(false);
  }

  useEffect(() => {
    const c = course.trim();
    setPrices(null);
    if (c.length < 4) return;
    const t = setTimeout(() => {
      api<{ prices: CoursePrices | null }>(`/api/course-prices?course=${encodeURIComponent(c)}`).then((r) => setPrices(r.prices)).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [course]);

  const range = prices ? (weekday < 0 ? prices.all : (weekend ? prices.weekend : prices.weekday) || prices.all) : null;
  const rangeLabel = !prices || weekday < 0 || (weekend ? !prices.weekend : !prices.weekday) ? '' : weekend ? ' on weekends' : ' on weekdays';
  const teeSearch = `https://www.google.com/search?q=${encodeURIComponent(`${course || 'golf'} ${dest?.data.name || ''} tee times ${dayName}`)}`;

  return (
    <SheetForm submit={opt ? 'Save' : 'Add to the vote'}
      onSubmit={(fd) => {
        const priceChanged = !d || Number(fd.fee) !== Number(d.fee);
        const data = {
          course: course.trim(), url, day, time: fd.time, fee: num(fd.fee), booked: d?.booked || false, weekday,
          checked: priceChanged ? todayLabel() : d?.checked || todayLabel(),
          checkedAt: priceChanged ? new Date().toISOString() : d?.checkedAt || '',
          // A trip-idea estimate stays marked as one until someone enters a real price.
          ...(!priceChanged && d?.fromTemplate ? { fromTemplate: d.fromTemplate } : {}),
          ...(picked && picked.name === course.trim() ? {
            courseId: picked.id, lat: picked.lat, lon: picked.lon, access: picked.access,
            where: picked.city ? `${picked.city}, ${picked.state}` : d?.where || '',
          } : {}),
        };
        return opt ? save(ctx, 'update_option', { optionId: opt.id, data }, 'Saved') : save(ctx, 'add_option', { kind: 'round', data }, 'Round added to the vote');
      }}
      extra={opt ? <ConfirmButton label="Remove" onConfirm={() => save(ctx, 'delete_option', { optionId: opt.id }, 'Removed')} /> : undefined}>
      <div className="field">
        <label htmlFor="f-course">Course</label>
        <input id="f-course" name="course" value={course} autoComplete="off" required placeholder="Start typing a course name"
          role="combobox" aria-expanded={open && hits.length > 0} aria-controls="course-hits"
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onChange={(e) => { setCourse(e.target.value); setOpen(true); if (picked && e.target.value !== picked.name) setPicked(null); }} />
        {open && hits.length > 0 && (
          <ul className="course-hits" id="course-hits" role="listbox">
            {hits.map((h) => (
              <li key={h.id} role="option" aria-selected={false}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(h)}>
                  <span className="grow"><span className="row-title">{h.name}</span><span className="row-meta"> · {h.city}, {h.state}{h.miles !== undefined ? ` · ${h.miles} mi` : ''}</span></span>
                  {h.access && <span className={`access ${h.access}`}>{ACCESS_LABEL[h.access]}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {picked && picked.name === course.trim()
          ? <p className="hint">{[picked.access ? ACCESS_LABEL[picked.access] : '', picked.city ? `${picked.city}, ${picked.state}` : ''].filter(Boolean).join(' · ')}{picked.access === 'private' ? ' · members and guests only' : ''}</p>
          : course.trim().length >= 3 && hits.length === 0 && <p className="hint">Not in the course list. You can still add it.</p>}
      </div>
      <div className="field">
        <label htmlFor="f-day">Day</label>
        <select id="f-day" value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {Array.from({ length: days }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{`Day ${n}${date ? ` · ${dayLabel(date.data.start, n)}` : ''}`}</option>)}
        </select>
      </div>
      <TimeField name="time" label="First tee time" defaultValue={d?.time} hint={state.members.length > 4 ? `${Math.ceil(state.members.length / 4)} tee times in a row` : undefined} />
      <div className="field">
        <label htmlFor="f-fee">Greens fee per player, with cart ($)</label>
        <input id="f-fee" name="fee" type="number" inputMode="decimal" min={0} step="any" required value={fee} onChange={(e) => setFee(e.target.value)} placeholder={range ? String(range.median) : '150'} />
      </div>
      {range && (
        <div className="price-hint">
          <div>
            <div className="row-title">${range.low === range.high ? range.low : `${range.low}–${range.high}`}{rangeLabel}</div>
            <div className="row-meta">What Foresome groups paid · {range.count} {range.count === 1 ? 'report' : 'reports'}{prices?.latest ? ` · latest ${prices.latest}` : ''}</div>
          </div>
          <button type="button" className="btn small" onClick={() => setFee(String(range.median))}>Use ${range.median}</button>
        </div>
      )}
      <div className="btn-row">
        {url && <a className="btn small" href={url} target="_blank" rel="noopener noreferrer">Course website</a>}
        <a className="btn small" href={teeSearch} target="_blank" rel="noopener noreferrer">Check live tee times{dayName ? ` for ${dayName}` : ''}</a>
      </div>

    </SheetForm>
  );
}

export function roundSheet(ctx: TripCtx, opt?: Option<RoundData>, day = 1, prefillCourse?: string, prefillUrl?: string) {
  ctx.sheet({ title: opt ? 'Edit round' : 'Suggest a round', body: <RoundForm ctx={ctx} opt={opt} day={day} prefillCourse={prefillCourse} prefillUrl={prefillUrl} /> });
}

export function manualFlightSheet(ctx: TripCtx) {
  const m = ctx.me!;
  ctx.sheet({
    title: 'Enter your flight',
    body: (
      <SheetForm submit="Save my flight" onSubmit={(fd) => save(ctx, 'set_flight', {
        price: num(fd.price), summary: fd.summary, arriveAt: fd.arrive || null, departAt: fd.depart || null,
      }, 'Flight saved')}>
        <Field name="summary" label="Airline and flight" defaultValue={m.flight_summary || ''} placeholder="Southwest 1432, nonstop" />
        <Field name="price" label="Round-trip price ($), or 0 if driving" type="number" defaultValue={m.flight_price ?? ''} required />
        <Field name="arrive" label="Arrival at destination (local time)" type="datetime-local" defaultValue={m.flight_arrive_at?.slice(0, 16) || ''} />
        <Field name="depart" label="Departure for home (local time)" type="datetime-local" defaultValue={m.flight_depart_at?.slice(0, 16) || ''} />
      </SheetForm>
    ),
  });
}

/** Organizer-only: hand off the role, delete the trip. Lives under the trip details sheet. */
function OrganizerTools({ ctx }: { ctx: TripCtx }) {
  const others = ctx.state.members.filter((m) => m.id !== ctx.me?.id);
  const [to, setTo] = useState(others[0]?.id || '');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const name = ctx.state.trip.name;
  return (
    <div className="stack" style={{ marginTop: 24 }}>
      {others.length > 0 && (
        <div className="section">
          <h2>Hand off organizer</h2>
          <p className="sub">You stay on the trip.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <select className="mini-select" style={{ flex: 1, minHeight: 44, fontSize: 15 }} value={to} onChange={(e) => setTo(e.target.value)} aria-label="New organizer">
              {others.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <ConfirmButton className="btn" label="Make organizer" confirmLabel="Tap to confirm"
              onConfirm={async () => { if (await ctx.act('make_organizer', { memberId: to })) { ctx.sheet(null); ctx.toast('Organizer handed off'); } }} />
          </div>
        </div>
      )}
      <div className="section">
        <h2>Delete trip</h2>
        <p className="sub">Removes the trip and every vote for everyone. This can’t be undone. Type <strong>{name}</strong> to confirm.</p>
        <input className="mini-select" style={{ minHeight: 44, fontSize: 16, fontWeight: 500 }} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={name} aria-label="Type the trip name to confirm" />
        <button className="btn danger block" disabled={busy || confirm.trim().toLowerCase() !== name.trim().toLowerCase()}
          onClick={async () => {
            setBusy(true);
            if (await ctx.act('delete_trip', { confirm })) { clearToken(ctx.state.trip.code); location.href = '/'; }
            else setBusy(false);
          }}>Delete this trip</button>
      </div>
    </div>
  );
}

function PairingsForm({ ctx, r }: { ctx: TripCtx; r: Option<RoundData> }) {
  const members = ctx.state.members;
  const start = (): Record<string, number> => {
    const saved = r.data.groups || [];
    const out: Record<string, number> = {};
    const fresh = autoGroups(members.map((m) => m.id));
    for (const m of members) {
      const i = saved.findIndex((g) => g.includes(m.id));
      out[m.id] = i >= 0 ? i : fresh.findIndex((g) => g.includes(m.id));
    }
    return out;
  };
  const [pick, setPick] = useState<Record<string, number>>(start);
  const [count, setCount] = useState(() => Math.max(teeTimesNeeded(members.length), ...Object.values(start()).map((i) => i + 1)));
  const shuffle = () => {
    const g = autoGroups(members.map((m) => m.id));
    setCount(g.length);
    const out: Record<string, number> = {};
    g.forEach((ids, i) => ids.forEach((id) => { out[id] = i; }));
    setPick(out);
  };
  const groups = Array.from({ length: count }, (_, i) => members.filter((m) => Math.min(pick[m.id] ?? 0, count - 1) === i).map((m) => m.id));
  const tooBig = groups.some((g) => g.length > 4);
  return (
    <div className="stack">
      <p className="sub">{r.data.course} · 10 minutes apart</p>
      <div className="btn-row">
        <button type="button" className="btn small" onClick={shuffle}>Shuffle</button>
        <button type="button" className="btn small ghost" disabled={count <= 1} onClick={() => setCount(count - 1)}>− Group</button>
        <button type="button" className="btn small ghost" disabled={count >= members.length} onClick={() => setCount(count + 1)}>+ Group</button>
      </div>
      {groups.map((g, i) => (
        <div className="card" key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="row-title">Group {i + 1} · {teeAfter(r.data.time, i)} {g.length > 4 && <Chip kind="warn">{g.length} players</Chip>}</div>
          {g.length === 0 && <div className="row-meta">Nobody yet</div>}
          {g.map((id) => {
            const m = members.find((x) => x.id === id)!;
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="grow">{m.name}</span>
                <select className="mini-select" value={i} aria-label={`Group for ${m.name}`} onChange={(e) => setPick({ ...pick, [id]: Number(e.target.value) })}>
                  {Array.from({ length: count }, (_, j) => <option key={j} value={j}>Group {j + 1}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      ))}
      {tooBig && <p className="hint">Most courses allow 4 per tee time.</p>}
      <div className="btn-row">
        <button className="btn primary" onClick={() => save(ctx, 'update_option', { optionId: r.id, data: { ...r.data, groups: groups.filter((g) => g.length) } }, 'Pairings saved')}>Save pairings</button>
        {r.data.groups?.length ? <button className="btn ghost" onClick={() => save(ctx, 'update_option', { optionId: r.id, data: { ...r.data, groups: [] } }, 'Pairings cleared')}>Clear</button> : null}
      </div>
    </div>
  );
}
export function pairingsSheet(ctx: TripCtx, r: Option<RoundData>) {
  ctx.sheet({ title: 'Pairings', body: <PairingsForm ctx={ctx} r={r} /> });
}
