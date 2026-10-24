'use client';

import { useEffect, useState } from 'react';
import type { CourseAccess, CoursePrices, CourseTee, NearbyCourse, WeatherDay, WeatherReport } from '@/lib/shared';
import { ACCESS_LABEL } from '@/lib/shared';
import { bedsNeeded, lodgingSearchLinks, rangeLabel, tripNights } from '@/lib/shared';
import { Chip, useTrip } from './ui';
import { roundSheet } from './sheets';
import { TeeStats } from './TeeTable';

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
        {[data.rain !== null ? `${data.rain}% rain` : '', data.wind !== null ? `${data.wind} mph wind` : ''].filter(Boolean).join(' · ')}
      </div>
    </div>
  );
}

/** Compact weather for one trip day, shown next to the day on the Golf tab. */
export function DayWeather({ day, mode }: { day: WeatherDay | undefined; mode: WeatherReport['mode'] }) {
  if (!day) return null;
  return (
    <span className="wx-day">
      {day.hi !== null ? `${deg(day.hi)}/${deg(day.lo)}` : `Tonight ${deg(day.lo)}`}{day.rain !== null ? ` · ${day.rain}% rain` : ''}{day.wind !== null && day.wind >= 18 ? ` · windy` : ''}
    </span>
  );
}

export function WeatherCredit() {
  return <p className="hint">Weather: <a href="https://www.weather.gov/" target="_blank" rel="noopener noreferrer">NWS</a>, <a href="https://www.ncei.noaa.gov/" target="_blank" rel="noopener noreferrer">NOAA</a>, <a href="https://power.larc.nasa.gov/" target="_blank" rel="noopener noreferrer">NASA</a></p>;
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
      <p className="hint">Found one? Copy its link and tap <strong>Place</strong>.</p>
    </div>
  );
}

/* ---------- courses near the destination ---------- */
interface GooglePlace { name: string; rating: number; count: number; url: string; lat: number; lon: number }
const GENERIC_WORDS = new Set(['the', 'golf', 'club', 'course', 'country', 'cc', 'gc', 'resort', 'links', 'and', 'at', 'of']);
const nameWords = (s: string) => s.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w && !GENERIC_WORDS.has(w));
function milesBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.sqrt(h));
}
/** The Google Maps listing for a course: close by and sharing a real word of its name (or right on top of it). */
function googleFor(c: NearbyCourse, places: GooglePlace[]): GooglePlace | null {
  const w = nameWords(c.name);
  let best: GooglePlace | null = null, bestD = Infinity;
  for (const p of places) {
    const d = milesBetween(c, p);
    const shared = nameWords(p.name).some((x) => w.includes(x));
    if ((shared && d < 2) || d < 0.3) { if (d < bestD) { best = p; bestD = d; } }
  }
  return best;
}

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
  // Course type and tees from the course database, for the courses on screen.
  const matchUrl = names ? `/api/course-match?place=${encodeURIComponent(dest)}${list.slice(0, limit).map((c) => `&course=${encodeURIComponent(c.name)}`).join('')}` : null;
  const db = useLoad<{ courses: Record<string, { access: CourseAccess; tees: CourseTee[] }> }>(matchUrl).data?.courses || {};
  const google = useLoad<{ enabled: boolean; places: GooglePlace[] }>(`/api/google-ratings?place=${encodeURIComponent(dest)}&miles=${radius}`).data;
  const ratingOf = (c: NearbyCourse) => (google?.places.length ? googleFor(c, google.places) : null);
  const shownRatings = list.slice(0, limit).some((c) => ratingOf(c));

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
                    <div className="row-meta">
                      {(() => { const g = ratingOf(c); return g ? <a className="g-rating" href={g.url} target="_blank" rel="noopener noreferrer" aria-label={`${g.rating} out of 5 on Google Maps, ${g.count} reviews`}>★ {g.rating.toFixed(1)} <span>({g.count.toLocaleString('en-US')})</span></a> : null; })()}
                      {(() => {
                        const access = db[c.name]?.access || (c.isPrivate ? 'private' : '');
                        return access ? <span className={`access ${access}`}>{ACCESS_LABEL[access]}</span> : null;
                      })()}
                      {c.miles} mi away{c.holes ? ` · ${c.holes} holes` : ''}
                    </div>
                    {db[c.name]?.tees?.length ? <TeeStats tees={db[c.name].tees} /> : null}
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
      {shownRatings && <p className="google-attrib">Ratings: Google Maps</p>}
      <p className="hint">Course data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a> via <a href="https://opengolfapi.org/attribution" target="_blank" rel="noopener noreferrer">OpenGolfAPI</a></p>
    </section>
  );
}

