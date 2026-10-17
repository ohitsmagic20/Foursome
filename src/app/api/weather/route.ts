import { geocode } from '@/lib/geo';
import { handle, HttpError, int, str } from '@/lib/server';
import { addDays, isoDay, parseDay } from '@/lib/shared';
import type { WeatherReport, WeatherDay } from '@/lib/shared';

// Weather for a destination and trip dates, from Open-Meteo (free, no key).
// Within 16 days: the real forecast. Further out: what those same dates were like over the last 5 years.

const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max';
const UNITS = 'temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto';
const RAIN_DAY_INCHES = 0.04; // about 1 mm: enough to notice on the course

interface Daily { time: string[]; temperature_2m_max: (number | null)[]; temperature_2m_min: (number | null)[]; precipitation_sum: (number | null)[]; wind_speed_10m_max: (number | null)[]; precipitation_probability_max?: (number | null)[] }

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const r = (n: number) => (Number.isFinite(n) ? Math.round(n) : null);

export function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const placeQ = str(q.get('place'), 80);
    const start = str(q.get('start'), 10);
    const nights = int(q.get('nights'), 1, 10, 3);
    if (!placeQ) throw new HttpError(400, 'Missing place.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new HttpError(400, 'Missing start date.');

    const place = await geocode(placeQ);
    if (!place) throw new HttpError(404, `Couldn't find “${placeQ}” on the map. Try “City, ST”.`);

    const first = parseDay(start);
    const count = nights + 1;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const offset = Math.round((first.getTime() - today.getTime()) / 864e5);
    const base = `latitude=${place.lat}&longitude=${place.lon}&daily=${DAILY}&${UNITS}`;

    let report: WeatherReport;

    if (offset >= 0 && offset + count <= 16) {
      const url = `https://api.open-meteo.com/v1/forecast?${base},precipitation_probability_max&start_date=${start}&end_date=${isoDay(addDays(first, nights))}`;
      const res = await fetch(url, { next: { revalidate: 60 * 60 } });
      if (!res.ok) throw new HttpError(502, 'The weather service did not respond. Try again in a minute.');
      const d = ((await res.json()) as { daily: Daily }).daily;
      const days: WeatherDay[] = d.time.map((date, i) => ({
        date,
        hi: r(d.temperature_2m_max[i] ?? NaN),
        lo: r(d.temperature_2m_min[i] ?? NaN),
        rain: r(d.precipitation_probability_max?.[i] ?? ((d.precipitation_sum[i] ?? 0) >= RAIN_DAY_INCHES ? 70 : 10)),
        wind: r(d.wind_speed_10m_max[i] ?? NaN),
      }));
      report = { mode: 'forecast', years: 0, days, ...summarize(days) };
    } else {
      // Same calendar dates in the 5 most recent years that are fully in the past.
      const last = addDays(first, nights);
      const cutoff = addDays(today, -7); // the archive runs a few days behind
      const years: number[] = [];
      for (let y = today.getFullYear(); years.length < 5 && y > today.getFullYear() - 8; y--) {
        const shift = y - first.getFullYear();
        const e = new Date(last); e.setFullYear(last.getFullYear() + shift);
        if (e <= cutoff) years.push(y);
      }
      const runs = await Promise.all(years.map(async (y) => {
        const shift = y - first.getFullYear();
        const s = new Date(first); s.setFullYear(first.getFullYear() + shift);
        const e = addDays(s, nights);
        const url = `https://archive-api.open-meteo.com/v1/archive?${base}&start_date=${isoDay(s)}&end_date=${isoDay(e)}`;
        const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 * 7 } });
        if (!res.ok) return null;
        return ((await res.json()) as { daily: Daily }).daily;
      }));
      const good = runs.filter((x): x is Daily => !!x && Array.isArray(x.time));
      if (!good.length) throw new HttpError(502, 'Past weather for these dates is not available right now.');
      const days: WeatherDay[] = Array.from({ length: count }, (_, i) => {
        const pick = (k: keyof Daily) => good.map((g) => (g[k] as (number | null)[] | undefined)?.[i]).filter((v): v is number => typeof v === 'number');
        const rainYears = pick('precipitation_sum');
        return {
          date: isoDay(addDays(first, i)),
          hi: r(avg(pick('temperature_2m_max'))),
          lo: r(avg(pick('temperature_2m_min'))),
          rain: rainYears.length ? Math.round((rainYears.filter((v) => v >= RAIN_DAY_INCHES).length / rainYears.length) * 100) : null,
          wind: r(avg(pick('wind_speed_10m_max'))),
        };
      });
      report = { mode: 'typical', years: good.length, days, ...summarize(days) };
    }

    return Response.json({ ...report, place: `${place.name}${place.region ? `, ${place.region}` : ''}` }, {
      headers: { 'Cache-Control': 'public, max-age=3600' },
    });
  });
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
