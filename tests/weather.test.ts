import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, isoDay, weatherBasis, type WeatherReport } from '@/lib/shared';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/geo', () => ({ geocode: async () => ({ lat: 33.49, lon: -111.92, name: 'Scottsdale', region: 'AZ' }) }));

const { GET } = await import('@/app/api/weather/route');

const day = (n: number) => isoDay(addDays(new Date(new Date().setHours(0, 0, 0, 0)), n));
let calls: string[] = [];

/** Fake NWS (forecast reaches 6 days out), NOAA normals and NASA POWER. */
function fakeFetch(opts: { nws?: boolean } = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (url.includes('api.weather.gov/points')) return opts.nws === false ? new Response('', { status: 404 }) : json({ properties: { forecast: 'https://api.weather.gov/gridpoints/PSR/1,1/forecast' } });
    if (url.includes('gridpoints')) {
      const periods = Array.from({ length: 7 }, (_, i) => [
        { startTime: `${day(i)}T06:00:00-07:00`, isDaytime: true, temperature: 70 + i, temperatureUnit: 'F', windSpeed: '5 to 10 mph', probabilityOfPrecipitation: { value: 20 } },
        { startTime: `${day(i)}T18:00:00-07:00`, isDaytime: false, temperature: 50, temperatureUnit: 'F', windSpeed: '5 mph', probabilityOfPrecipitation: { value: null } },
      ]).flat();
      return json({ properties: { periods } });
    }
    if (url.includes('/search/v1/data')) return json({ results: [{ location: { coordinates: [-111.9, 33.5] }, stations: [{ id: 'USW00023183' }] }] });
    if (url.includes('/data/v1')) {
      const q = new URL(url).searchParams;
      expect(q.get('dataTypes')).toContain('DLY-PRCP-PCTALL-GE001HI');
      const [a, b] = [q.get('startDate')!, q.get('endDate')!].map((x) => x.slice(5));
      const rows = [];
      for (let d = new Date(`2010-${a}T00:00:00`); isoDay(d).slice(5) <= b; d = addDays(d, 1)) {
        rows.push({ DATE: isoDay(d).slice(5), STATION: 'USW00023183', 'DLY-TMAX-NORMAL': '77.0', 'DLY-TMIN-NORMAL': '52.0', 'DLY-PRCP-PCTALL-GE001HI': '9.0' });
      }
      return json(rows);
    }
    if (url.includes('power.larc.nasa.gov')) return new Response('', { status: 500 });
    throw new Error('unexpected ' + url);
  });
}

const get = async (start: string, nights: number) => {
  const res = await GET(new Request(`http://x/api/weather?place=Scottsdale%2C%20AZ&start=${start}&nights=${nights}`));
  return (await res.json()) as WeatherReport;
};

beforeEach(() => { calls = []; });
afterEach(() => { vi.unstubAllGlobals(); });

describe('weather', () => {
  it('uses the NWS forecast when the whole trip is within reach', async () => {
    vi.stubGlobal('fetch', fakeFetch());
    const w = await get(day(1), 2);
    expect(w.mode).toBe('forecast');
    expect(w.days.map((d) => d.hi)).toEqual([71, 72, 73]);
    expect(w.days.every((d) => d.fc)).toBe(true);
    expect(weatherBasis(w)).toBe('National Weather Service forecast');
    expect(calls.some((u) => u.includes('ncei'))).toBe(false);
  });

  it('mixes forecast days with NOAA averages when the trip runs past the forecast', async () => {
    vi.stubGlobal('fetch', fakeFetch());
    const w = await get(day(5), 3); // days 5–8; forecast reaches day 6
    expect(w.mode).toBe('typical');
    expect(w.days.map((d) => !!d.fc)).toEqual([true, true, false, false]);
    expect(w.days[0].hi).toBe(75);
    expect(w.days[3]).toMatchObject({ hi: 77, lo: 52, rain: 9 });
    expect(weatherBasis(w)).toBe('Forecast for 2 days, NOAA 30-year averages for the rest');
  });

  it('uses NOAA 30-year averages for a trip months away', async () => {
    vi.stubGlobal('fetch', fakeFetch());
    const w = await get(day(120), 4);
    expect(w.mode).toBe('typical');
    expect(w.source).toBe('noaa');
    expect(w.days).toHaveLength(5);
    expect(w.hi).toBe(77);
    expect(w.rain).toBe(9);
    expect(calls.some((u) => u.includes('api.weather.gov'))).toBe(false);
    expect(weatherBasis(w)).toBe('Typical for these dates: NOAA 30-year averages');
  });

  it('still forecasts the remaining days of a trip already under way', async () => {
    vi.stubGlobal('fetch', fakeFetch());
    const w = await get(day(-2), 4); // started 2 days ago
    expect(w.days.map((d) => !!d.fc)).toEqual([false, false, true, true, true]);
    expect(w.days[2].hi).toBe(70);
  });
});
