import { geocode } from '@/lib/geo';
import { handle, HttpError, int, str } from '@/lib/server';
import { addDays, isoDay, parseDay } from '@/lib/shared';
import type { WeatherReport, WeatherDay } from '@/lib/shared';

// Weather for a destination and trip dates, from free US government sources (no key, fine for commercial use):
//  - Within the next 7 days in the US: the National Weather Service forecast (api.weather.gov).
//  - Otherwise, in the US: NOAA's 1991–2020 climate normals from the nearest weather station (NCEI).
//  - Outside the US (and for wind): what those same dates were like over the last 5 years, from NASA POWER (worldwide).

const UA = 'Foresome golf trip planner (https://www.foresomes.net; support@foresomes.net)';
const RAIN_DAY_INCHES = 0.04; // about 1 mm: enough to notice on the course
const FORECAST_DAYS = 7;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const r = (n: number) => (Number.isFinite(n) ? Math.round(n) : null);

export function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const placeQ = str(q.get('place'), 80);
    const start = str(q.get('start'), 10);
    const nights = int(q.get('nights'), 1, 14, 3);
    if (!placeQ) throw new HttpError(400, 'Missing place.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new HttpError(400, 'Missing start date.');

    const place = await geocode(placeQ);
    if (!place) throw new HttpError(404, `Couldn't find “${placeQ}” on the map. Try “City, ST”.`);

    const first = parseDay(start);
    const count = nights + 1;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const offset = Math.round((first.getTime() - today.getTime()) / 864e5);

    let report: WeatherReport | null = null;
    if (offset >= 0 && offset + count <= FORECAST_DAYS) {
      const days = await nwsForecast(place.lat, place.lon, start, count);
      if (days) report = { mode: 'forecast', years: 0, days, ...summarize(days) };
    }
    if (!report) {
      // US: NOAA's official 1991–2020 normals from the nearest weather station (most accurate, especially on the coast).
      // NASA's 5-year history fills in wind, and covers trips outside the US.
      const [normals, nasa] = await Promise.all([
        noaaNormals(place.lat, place.lon, first, nights).catch(() => null),
        typical(place.lat, place.lon, first, nights, today).catch((e) => { if (!(e instanceof HttpError)) console.error(e); return null; }),
      ]);
      if (normals) {
        const days = normals.map((d, i) => ({ ...d, wind: nasa?.days[i]?.wind ?? null }));
        report = { mode: 'typical', years: 30, days, ...summarize(days) };
      } else if (nasa) {
        report = { mode: 'typical', years: nasa.years, days: nasa.days, ...summarize(nasa.days) };
      } else throw new HttpError(502, 'Past weather for these dates is not available right now.');
    }

    return Response.json({ ...report, place: `${place.name}${place.region ? `, ${place.region}` : ''}` }, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  });
}

interface NwsPeriod { startTime: string; isDaytime: boolean; temperature: number; temperatureUnit: string; windSpeed: string; probabilityOfPrecipitation?: { value: number | null } }

/** The official NWS forecast, day and night periods folded into days. Null outside the US or if NWS is down. */
async function nwsForecast(lat: number, lon: number, start: string, count: number): Promise<WeatherDay[] | null> {
  const get = async (url: string, revalidate: number) => {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/geo+json' }, next: { revalidate } });
    return res.ok ? res.json() : null;
  };
  try {
    const point = await get(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, 60 * 60 * 24 * 30);
    const url = point?.properties?.forecast as string | undefined;
    if (!url) return null;
    const fc = await get(url, 60 * 60);
    const periods = (fc?.properties?.periods || []) as NwsPeriod[];
    if (!periods.length) return null;
    const first = parseDay(start);
    const days: WeatherDay[] = [];
    for (let i = 0; i < count; i++) {
      const date = isoDay(addDays(first, i));
      const ps = periods.filter((p) => p.startTime.slice(0, 10) === date);
      if (!ps.length) return null; // the forecast doesn't reach this day
      const f = (p: NwsPeriod) => (p.temperatureUnit === 'C' ? p.temperature * 9 / 5 + 32 : p.temperature);
      const day = ps.find((p) => p.isDaytime), night = ps.find((p) => !p.isDaytime);
      const pops = ps.map((p) => p.probabilityOfPrecipitation?.value).filter((v): v is number => typeof v === 'number');
      const winds = ps.flatMap((p) => (p.windSpeed.match(/\d+/g) || []).map(Number));
      days.push({
        date,
        hi: day ? r(f(day)) : null,
        lo: night ? r(f(night)) : null,
        rain: pops.length ? Math.max(...pops) : 0,
        wind: winds.length ? Math.max(...winds) : null,
      });
    }
    return days;
  } catch { return null; }
}

const NCEI = 'https://www.ncei.noaa.gov/access/services';
const NORMALS = 'normals-daily-1991-2020';

/** NOAA daily climate normals (1991–2020) at the nearest US station with temperature normals. Null if none nearby. */
async function noaaNormals(lat: number, lon: number, first: Date, nights: number): Promise<WeatherDay[] | null> {
  let station: string | null = null;
  for (const pad of [0.3, 0.7]) {
    const bbox = [lat + pad, lon - pad, lat - pad, lon + pad].map((x) => x.toFixed(3)).join(',');
    const res = await fetch(`${NCEI}/search/v1/data?dataset=${NORMALS}&bbox=${bbox}&dataTypes=DLY-TMAX-NORMAL&limit=25`, { headers: { 'User-Agent': UA }, next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) return null;
    const j = (await res.json()) as { results?: { location?: { coordinates?: [number, number] }; stations?: { id: string }[] }[] };
    const near = (j.results || [])
      .filter((x) => x.location?.coordinates && x.stations?.[0]?.id)
      .map((x) => ({ id: x.stations![0].id, d: Math.hypot(x.location!.coordinates![1] - lat, (x.location!.coordinates![0] - lon) * Math.cos((lat * Math.PI) / 180)) }))
      .sort((a, b) => a.d - b.d)[0];
    if (near) { station = near.id; break; }
  }
  if (!station) return null;

  // Normals are by calendar day; request the trip's days (split at New Year), keyed "MM-DD".
  const dates = Array.from({ length: nights + 1 }, (_, i) => addDays(first, i));
  const md = (d: Date) => isoDay(d).slice(5);
  const ranges: [string, string][] = [];
  for (const d of dates) {
    const k = md(d) === '02-29' ? '02-28' : md(d);
    const last = ranges[ranges.length - 1];
    if (last && k > last[1]) last[1] = k; else ranges.push([k, k]);
  }
  const rows: Record<string, Record<string, string>> = {};
  for (const [a, b] of ranges) {
    const res = await fetch(`${NCEI}/data/v1?dataset=${NORMALS}&stations=${station}&startDate=2010-${a}&endDate=2010-${b}&dataTypes=DLY-TMAX-NORMAL,DLY-TMIN-NORMAL,DLY-PRCP-PCTALL-GE010HI&format=json`, { headers: { 'User-Agent': UA }, next: { revalidate: 60 * 60 * 24 * 30 } });
    if (!res.ok) return null;
    for (const row of (await res.json()) as Record<string, string>[]) rows[row.DATE] = row;
  }
  const num = (v?: string) => { const n = Number(String(v ?? '').trim()); return Number.isFinite(n) && n > -90 ? n : NaN; };
  const days = dates.map((d) => {
    const row = rows[md(d) === '02-29' ? '02-28' : md(d)] || {};
    return { date: isoDay(d), hi: r(num(row['DLY-TMAX-NORMAL'])), lo: r(num(row['DLY-TMIN-NORMAL'])), rain: r(num(row['DLY-PRCP-PCTALL-GE010HI'])), wind: null };
  });
  return days.some((d) => d.hi !== null) ? days : null;
}

type PowerParams = Record<'T2M_MAX' | 'T2M_MIN' | 'PRECTOTCORR' | 'WS10M_MAX', Record<string, number>>;

/** The same calendar dates over the 5 most recent years fully in the past, averaged (NASA POWER, worldwide). */
async function typical(lat: number, lon: number, first: Date, nights: number, today: Date) {
  const last = addDays(first, nights);
  const cutoff = addDays(today, -10); // NASA's daily data runs a few days behind
  const years: number[] = [];
  for (let y = today.getFullYear(); years.length < 5 && y > today.getFullYear() - 8; y--) {
    const e = new Date(last); e.setFullYear(last.getFullYear() + (y - first.getFullYear()));
    if (e <= cutoff) years.push(y);
  }
  const ymd = (d: Date) => isoDay(d).replace(/-/g, '');
  const runs = await Promise.all(years.map(async (y) => {
    const s = new Date(first); s.setFullYear(first.getFullYear() + (y - first.getFullYear()));
    const e = addDays(s, nights);
    const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,WS10M_MAX&community=RE&latitude=${lat.toFixed(3)}&longitude=${lon.toFixed(3)}&start=${ymd(s)}&end=${ymd(e)}&format=JSON`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, next: { revalidate: 60 * 60 * 24 * 30 } });
      if (!res.ok) return null;
      const p = (await res.json())?.properties?.parameter as PowerParams | undefined;
      if (!p?.T2M_MAX) return null;
      // Day i of the trip in that year.
      return Array.from({ length: nights + 1 }, (_, i) => {
        const k = ymd(addDays(s, i));
        const v = (x: Record<string, number>) => (typeof x?.[k] === 'number' && x[k] > -900 ? x[k] : NaN);
        return { hi: v(p.T2M_MAX) * 9 / 5 + 32, lo: v(p.T2M_MIN) * 9 / 5 + 32, rainIn: v(p.PRECTOTCORR) / 25.4, windMph: v(p.WS10M_MAX) * 2.237 };
      });
    } catch { return null; }
  }));
  const good = runs.filter((x): x is NonNullable<typeof x> => !!x);
  if (!good.length) throw new HttpError(502, 'Past weather for these dates is not available right now.');
  const days: WeatherDay[] = Array.from({ length: nights + 1 }, (_, i) => {
    const col = (k: 'hi' | 'lo' | 'rainIn' | 'windMph') => good.map((g) => g[i][k]).filter(Number.isFinite);
    const rain = col('rainIn');
    return {
      date: isoDay(addDays(first, i)),
      hi: r(avg(col('hi'))),
      lo: r(avg(col('lo'))),
      rain: rain.length ? Math.round((rain.filter((v) => v >= RAIN_DAY_INCHES).length / rain.length) * 100) : null,
      wind: r(avg(col('windMph'))),
    };
  });
  return { days, years: good.length };
}

function summarize(days: WeatherDay[]) {
  const nums = (k: 'hi' | 'lo' | 'rain' | 'wind') => days.map((d) => d[k]).filter((v): v is number => typeof v === 'number');
  const hi = r(avg(nums('hi'))), lo = r(avg(nums('lo'))), rain = r(avg(nums('rain'))), wind = r(avg(nums('wind')));
  let verdict: WeatherReport['verdict'] = 'mixed';
  if (hi !== null && hi < 50) verdict = 'cold';
  else if (hi !== null && hi > 95) verdict = 'hot';
  else if (rain !== null && rain >= 50) verdict = 'wet';
  else if (hi !== null && hi >= 60 && (rain ?? 0) < 35 && (wind ?? 0) < 20) verdict = 'good';
  return { hi, lo, rain, wind, verdict };
}
