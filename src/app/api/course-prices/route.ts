import { db, handle, HttpError, str } from '@/lib/server';
import type { CoursePrices, PriceRange } from '@/lib/shared';
import { isWeekendDay } from '@/lib/shared';

export const dynamic = 'force-dynamic';

// Greens fees that Foursome users have entered for a course, across all trips, summarized as weekday and
// weekend ranges. Only prices are shared: no trip, person or date details leave the server.
//   GET /api/course-prices?course=Caledonia Golf %26 Fish Club
//   GET /api/course-prices?courses=Name A|Name B|Name C   (up to 40, exact names)

interface Row { data: { course?: string; fee?: number; weekday?: number; checked?: string; checkedAt?: string } }

const MAX_AGE_DAYS = 400; // older prices are too stale to be useful

function range(fees: number[]): PriceRange | null {
  if (!fees.length) return null;
  const s = fees.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return { low: s[0], high: s[s.length - 1], median: s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2), count: s.length };
}

function summarize(course: string, rows: Row[]): CoursePrices | null {
  const cutoff = Date.now() - MAX_AGE_DAYS * 864e5;
  const fresh = rows.filter((r) => Number(r.data.fee) > 0 && (!r.data.checkedAt || Date.parse(r.data.checkedAt) >= cutoff));
  if (!fresh.length) return null;
  const fee = (r: Row) => Math.round(Number(r.data.fee));
  const known = fresh.filter((r) => typeof r.data.weekday === 'number' && r.data.weekday >= 0);
  const latest = fresh.map((r) => r.data.checkedAt || '').sort().pop() || '';
  return {
    course,
    weekday: range(known.filter((r) => !isWeekendDay(r.data.weekday!)).map(fee)),
    weekend: range(known.filter((r) => isWeekendDay(r.data.weekday!)).map(fee)),
    all: range(fresh.map(fee)),
    latest: latest ? new Date(latest).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : (fresh[fresh.length - 1].data.checked || ''),
  };
}

export function GET(req: Request) {
  return handle(async () => {
    const q = new URL(req.url).searchParams;
    const one = str(q.get('course'), 100);
    const many = str(q.get('courses'), 4000).split('|').map((s) => s.trim()).filter(Boolean).slice(0, 40);
    if (!one && !many.length) throw new HttpError(400, 'Name a course.');

    if (one) {
      const { data, error } = await db().from('options').select('data').eq('kind', 'round').ilike('data->>course', one.replace(/[%_]/g, '\\$&')).limit(300);
      if (error) throw error;
      return Response.json({ prices: summarize(one, (data || []) as Row[]) }, { headers: { 'Cache-Control': 'public, max-age=300' } });
    }

    const { data, error } = await db().from('options').select('data').eq('kind', 'round').in('data->>course', many).limit(2000);
    if (error) throw error;
    const by = new Map<string, Row[]>();
    for (const r of (data || []) as Row[]) {
      const k = String(r.data.course || '');
      by.set(k, [...(by.get(k) || []), r]);
    }
    const out: Record<string, CoursePrices> = {};
    for (const name of many) {
      const s = summarize(name, by.get(name) || []);
      if (s) out[name] = s;
    }
    return Response.json({ prices: out }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  });
}
