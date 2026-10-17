'use client';

import { useEffect, useRef, useState } from 'react';
import type { DestinationData, LodgingData, Option, RoundData, TripCtx } from './sheetTypes';
import type { CoursePrices, DateData, NearbyAirport, NearbyCourse } from '@/lib/shared';
import { addDays, dayLabel, destAirports, isWeekendDay, parseDay, pickOf } from '@/lib/shared';
import { api, getSession, todayLabel } from '@/lib/client';
import { ConfirmButton, Field, Select, SheetForm, TimeField } from './ui';

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
      <SheetForm submit="Save" onSubmit={(fd) => save(ctx, 'update_trip', { name: fd.name, nights: num(fd.nights), deposit: num(fd.deposit), food: num(fd.food) }, 'Trip updated')}>
        <Field name="name" label="Trip name" defaultValue={t.name} required />
        <div className="grid2">
          <Field name="nights" label="Nights" type="number" defaultValue={t.nights} min={1} max={10} step={1} />
          <Field name="deposit" label="Deposit each ($)" type="number" defaultValue={t.deposit} />
        </div>
        <Field name="food" label="Food and extras per person ($)" type="number" defaultValue={t.food} />
      </SheetForm>
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
      <SheetForm submit="Add to the vote" onSubmit={(fd) => save(ctx, 'add_option', { kind: 'date', data: { start: fd.start } }, 'Dates added to the vote')}>
        <Field name="start" label="Arrival date" type="date" defaultValue={iso} required />
        <p className="hint">The trip runs {ctx.state.trip.nights} nights from this date. Your vote counts as “in”.</p>
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
      {status === 'notfound' && <p className="hint">Couldn’t find that on the map. Try “City, ST”, or add an airport code below.</p>}
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
          <p className="hint">Pick one or more. Each person can search flights into any of them.</p>
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
      {courses && courses.length === 0 && <p className="hint">No golf courses showed up within 30 miles of this spot.</p>}
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
      <Field name="total" label={`Total for ${ctx.state.trip.nights} nights, with fees ($)`} type="number" defaultValue={opt?.data.total || ''} required />
      <div className="grid2">
        <Field name="bedrooms" label="Bedrooms" type="number" defaultValue={opt?.data.bedrooms || ''} />
        <Field name="beds" label="Beds" type="number" defaultValue={opt?.data.beds || ''} />
      </div>
      <p className="hint">Copy the total from the listing for your dates. Booking still happens on the listing’s site.</p>
    </SheetForm>
  );
}
export function lodgingSheet(ctx: TripCtx, opt?: Option<LodgingData>) {
  ctx.sheet({ title: opt ? 'Edit place' : 'Suggest a place to stay', body: <LodgingForm ctx={ctx} opt={opt} /> });
}

function RoundForm({ ctx, opt, day: startDay, prefillCourse, prefillUrl }: { ctx: TripCtx; opt?: Option<RoundData>; day: number; prefillCourse?: string; prefillUrl?: string }) {
  const { state } = ctx;
  const days = state.trip.nights + 1;
  const d = opt?.data;
  const date = pickOf<DateData>(state, 'date').option;
  const dest = pickOf<DestinationData>(state, 'destination').option;
  const [course, setCourse] = useState(d?.course ?? prefillCourse ?? '');
  const [url, setUrl] = useState(d?.url ?? prefillUrl ?? '');
  const [day, setDay] = useState(d?.day || startDay);
  const [fee, setFee] = useState(d?.fee ? String(d.fee) : '');
  const [nearby, setNearby] = useState<NearbyCourse[]>([]);
  const [prices, setPrices] = useState<CoursePrices | null>(null);

  const weekday = date ? addDays(parseDay(date.data.start), day - 1).getDay() : -1;
  const weekend = weekday >= 0 && isWeekendDay(weekday);
  const dayName = date ? dayLabel(date.data.start, day) : '';

  useEffect(() => {
    if (!dest) return;
    api<{ courses: NearbyCourse[] }>(`/api/courses?place=${encodeURIComponent(dest.data.name)}&miles=30`).then((r) => setNearby(r.courses)).catch(() => {});
  }, [dest?.data.name]); // eslint-disable-line react-hooks/exhaustive-deps

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
        };
        return opt ? save(ctx, 'update_option', { optionId: opt.id, data }, 'Saved') : save(ctx, 'add_option', { kind: 'round', data }, 'Round added to the vote');
      }}
      extra={opt ? <ConfirmButton label="Remove" onConfirm={() => save(ctx, 'delete_option', { optionId: opt.id }, 'Removed')} /> : undefined}>
      <div className="field">
        <label htmlFor="f-course">Course</label>
        <input id="f-course" name="course" value={course} list="nearby-courses" autoComplete="off" required placeholder={nearby[0] ? `e.g. ${nearby[0].name}` : 'Course name'}
          onChange={(e) => { const v = e.target.value; setCourse(v); const hit = nearby.find((c) => c.name === v); if (hit) setUrl(hit.website); }} />
        <datalist id="nearby-courses">{nearby.filter((c) => !c.isPrivate).map((c) => <option key={c.name} value={c.name}>{`${c.miles} mi`}</option>)}</datalist>
      </div>
      <div className="field">
        <label htmlFor="f-day">Day</label>
        <select id="f-day" value={day} onChange={(e) => setDay(Number(e.target.value))}>
          {Array.from({ length: days }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{`Day ${n}${date ? ` · ${dayLabel(date.data.start, n)}` : ''}`}</option>)}
        </select>
      </div>
      <TimeField name="time" label="First tee time" defaultValue={d?.time} hint={state.members.length > 4 ? `Your group needs ${Math.ceil(state.members.length / 4)} tee times in a row starting here.` : undefined} />
      <div className="field">
        <label htmlFor="f-fee">Greens fee per player, with cart ($)</label>
        <input id="f-fee" name="fee" type="number" inputMode="decimal" min={0} step="any" required value={fee} onChange={(e) => setFee(e.target.value)} placeholder={range ? String(range.median) : '150'} />
      </div>
      {range && (
        <div className="price-hint">
          <div>
            <div className="row-title">${range.low === range.high ? range.low : `${range.low}–${range.high}`}{rangeLabel}</div>
            <div className="row-meta">What Foursome groups paid · {range.count} {range.count === 1 ? 'report' : 'reports'}{prices?.latest ? ` · latest ${prices.latest}` : ''}</div>
          </div>
          <button type="button" className="btn small" onClick={() => setFee(String(range.median))}>Use ${range.median}</button>
        </div>
      )}
      <div className="btn-row">
        {url && <a className="btn small" href={url} target="_blank" rel="noopener noreferrer">Course website</a>}
        <a className="btn small" href={teeSearch} target="_blank" rel="noopener noreferrer">Check live tee times{dayName ? ` for ${dayName}` : ''}</a>
      </div>
      <p className="hint">Enter the rate you see for your day and time. It helps the next group: Foursome remembers prices so courses show typical weekday and weekend ranges.</p>
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
