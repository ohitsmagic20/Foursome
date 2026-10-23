'use client';

import { useEffect, useState } from 'react';
import type { CoursePrices, NearbyCourse, WeatherDay, WeatherReport } from '@/lib/shared';
import { bedsNeeded, lodgingSearchLinks, rangeLabel, tripNights } from '@/lib/shared';
import { Chip, useTrip } from './ui';
import { roundSheet } from './sheets';

/* ---------- shared fetch with a page-lifetime cache ---------- */
const cache = new Map<string, Promise<unknown>>();
function load<T>(url: string): Promise<T> {
  if (!cache.has(url)) {
    const p = fetch(url).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || 'Could not load.');
      return j;
    });
    p.catch(() => cache.delete(url)); // let a failed request be retried later
    cache.set(url, p);
  }
  return cache.get(url) as Promise<T>;
}
function useLoad<T>(url: string | null) {
  const [state, set] = useState<{ data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: !!url });
  useEffect(() => {
    if (!url) { set({ data: null, error: '', loading: false }); return; }
    let live = true;
    set((s) => ({ ...s, loading: true, error: '' }));
    load<T>(url).then(
      (data) => live && set({ data, error: '', loading: false }),
      (e) => live && set({ data: null, error: e instanceof Error ? e.message : 'Could not load.', loading: false }),
    );
    return () => { live = false; };
  }, [url]);
  return state;
}

/* ---------- weather ---------- */
export function useWeather(place: string | undefined, start: string | undefined, nights: number) {
  const url = place && start ? `/api/weather?place=${encodeURIComponent(place)}&start=${start}&nights=${nights}` : null;
  return useLoad<WeatherReport>(url);
}

const VERDICT: Record<WeatherReport['verdict'], [string, 'good' | 'warn' | 'bad' | 'plain']> = {
  good: ['Good golf weather', 'good'],
  mixed: ['Mixed', 'plain'],
  wet: ['Rainy', 'warn'],
  cold: ['Cold', 'bad'],
  hot: ['Very hot', 'warn'],
};
const deg = (n: number | null) => (n === null ? '–' : `${n}°`);

/** One line summary for a destination and dates. Used to compare destinations on the Trip tab. */
export function WeatherStrip({ place, start, nights }: { place: string; start: string; nights: number }) {
  const { data, error, loading } = useWeather(place, start, nights);
  if (loading) return <div className="wx muted">Checking the weather…</div>;
  if (error || !data) return <div className="wx muted">{error || 'Weather not available.'}</div>;
  const [label, kind] = VERDICT[data.verdict];
  return (
    <div className="wx">
      <div className="wx-head">
        <span className="wx-temp">{deg(data.hi)}<small> / {deg(data.lo)}</small></span>
        <Chip kind={kind}>{label}</Chip>
      </div>
      <div className="row-meta">
        {data.mode === 'forecast' ? 'Forecast' : `Typical for ${rangeLabel(start, nights)}, last ${data.years} years`}
        {data.rain !== null && ` · ${data.mode === 'forecast' ? `${data.rain}% chance of rain` : `rain on ${data.rain}% of days`}`}
        {data.wind !== null && ` · wind ${data.wind} mph`}
      </div>
    </div>
  );
}

/** Compact weather for one trip day, shown next to the day on the Golf tab. */
export function DayWeather({ day, mode }: { day: WeatherDay | undefined; mode: WeatherReport['mode'] }) {
  if (!day) return null;
  return (
    <span className="wx-day" title={mode === 'forecast' ? 'Forecast' : 'Typical for this date'}>
      {deg(day.hi)}/{deg(day.lo)}{day.rain !== null ? ` · ${day.rain}% rain` : ''}{day.wind !== null && day.wind >= 18 ? ` · windy` : ''}
    </span>
  );
}

export function WeatherCredit() {
  return <p className="hint">Weather by <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>. Within 16 days it’s the forecast; further out it’s the average for the same dates in recent years.</p>;
}

/* ---------- lodging searches ---------- */
export function StaySearch({ dest, start }: { dest: string; start: string }) {
  const { state } = useTrip();
  const n = state.members.length;
  const beds = bedsNeeded(state.members);
  const minBedrooms = Math.max(1, Math.ceil(beds * 0.75));
  const links = lodgingSearchLinks(dest, start, tripNights(state), n, minBedrooms);
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div className="row-title">Search {dest}</div>
        <div className="row-meta">{rangeLabel(start, tripNights(state))} · {n} {n === 1 ? 'guest' : 'guests'} · houses with {minBedrooms}+ bedrooms</div>
      </div>
      <div className="link-grid">
        {links.map((l) => (
          <a key={l.site} className="btn small" href={l.url} target="_blank" rel="noopener noreferrer">
            <span>{l.site}</span><span className="row-meta" style={{ fontWeight: 500 }}>{l.kind}</span>
          </a>
        ))}
      </div>
      <p className="hint">Opens each site with your dates and group filled in. Find one you like, copy its link, and tap <strong>Place</strong> to put it to a vote.</p>
    </div>
  );
}

/* ---------- courses near the destination ---------- */
export function CoursesNearby({ dest }: { dest: string }) {
  const ctx = useTrip();
  const [radius, setRadius] = useState(30);
  const [showPrivate, setShowPrivate] = useState(false);
  const [limit, setLimit] = useState(8);
  const { data, error, loading } = useLoad<{ place: string; courses: NearbyCourse[] }>(`/api/courses?place=${encodeURIComponent(dest)}&miles=${radius}`);
  const suggested = new Set(ctx.state.options.filter((o) => o.kind === 'round').map((o) => String((o.data as { course?: string }).course || '').toLowerCase()));
  const list = (data?.courses || []).filter((c) => showPrivate || !c.isPrivate);
  const names = list.slice(0, limit).map((c) => c.name).join('|');
  const priced = useLoad<{ prices: Record<string, CoursePrices> }>(names ? `/api/course-prices?courses=${encodeURIComponent(names)}` : null).data?.prices || {};

  return (
    <section className="section">
      <div className="section-head"><h2>Courses near {dest.split(',')[0]}</h2>
        <select aria-label="Distance" value={radius} onChange={(e) => { setRadius(Number(e.target.value)); setLimit(8); }} className="mini-select">
          <option value={15}>15 mi</option><option value={30}>30 mi</option><option value={50}>50 mi</option>
        </select>
      </div>
      {loading && <div className="card empty">Finding courses…</div>}
      {error && <div className="card empty">{error}</div>}
      {data && list.length === 0 && <div className="card empty">No courses found within {radius} miles. Try a wider distance.</div>}
      {list.length > 0 && (
        <div className="list">
          {list.slice(0, limit).map((c) => {
            const already = suggested.has(c.name.toLowerCase());
            const tee = `https://www.google.com/search?q=${encodeURIComponent(`${c.name} ${dest} tee times`)}`;
            return (
              <div className="row" key={c.name} style={{ alignItems: 'flex-start' }}>
                <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div>
                    <div className="row-title">{c.name}</div>
                    <div className="row-meta">{c.miles} mi away{c.holes ? ` · ${c.holes} holes` : ''}{c.isPrivate ? ' · Private' : ''}</div>
                    {priced[c.name]?.all && <div className="price-tag">Groups paid ${priced[c.name].all!.low === priced[c.name].all!.high ? priced[c.name].all!.low : `${priced[c.name].all!.low}–${priced[c.name].all!.high}`}</div>}
                  </div>
                  <div className="btn-row">
                    {c.website && <a className="btn small ghost" href={c.website} target="_blank" rel="noopener noreferrer">Website</a>}
                    <a className="btn small ghost" href={tee} target="_blank" rel="noopener noreferrer">Tee times</a>
                  </div>
                </div>
                {already ? <Chip kind="good">Suggested</Chip>
                  : <button className="btn small" onClick={() => roundSheet(ctx, undefined, Math.min(2, tripNights(ctx.state) + 1), c.name, c.website)}>Suggest</button>}
              </div>
            );
          })}
        </div>
      )}
      <div className="btn-row">
        {list.length > limit && <button className="btn small ghost" onClick={() => setLimit(limit + 10)}>Show more ({list.length - limit})</button>}
        {(data?.courses || []).some((c) => c.isPrivate) && (
          <button className="btn small ghost" onClick={() => setShowPrivate(!showPrivate)}>{showPrivate ? 'Hide private clubs' : 'Show private clubs'}</button>
        )}
      </div>
      <p className="hint">Course list from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>. Prices shown are what other Foresome groups entered. Tap Tee times for today’s rates.</p>
    </section>
  );
}

