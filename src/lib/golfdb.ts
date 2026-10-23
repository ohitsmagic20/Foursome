import 'server-only';
import { miles } from './geo';
import type { CourseAccess, CourseHit, CourseInfo } from './shared';

// US golf courses from OpenGolfAPI (free; course data © OpenStreetMap contributors, ODbL 1.0).
// Search answers are cached for a week and course details for a month, so each course is fetched rarely.

const API = 'https://api.opengolfapi.org';
const UA = 'Foresome golf trip planner (https://www.foresomes.net; support@foresomes.net)';

interface RawHit { id: string; name: string; course_name?: string; latitude: number; longitude: number; state: string | null; city: string | null; type: string | null; website?: string | null }
interface RawTee { tee_name?: string; gender?: string; course_rating?: number; slope?: number; yardage?: number; par?: number }
interface RawDetail {
  id: string; course_name: string; club_name?: string; city: string | null; state: string | null; lat: number; lng: number; type: string | null;
  par?: number; holes?: number; yardage?: number; phone?: string | null; website?: string | null; tees?: RawTee[];
  architect?: string | null; year_built?: number | null;
  description?: string | null; description_source?: { name?: string; url?: string } | null;
  facilities?: Record<string, unknown> | null;
}

const FACILITY: Record<string, string> = {
  driving_range: 'Driving range', putting_green: 'Putting green', restaurant: 'Restaurant', pro_shop: 'Pro shop',
  lessons: 'Lessons', club_rental: 'Club rental', lodging: 'Lodging', bar: 'Bar', caddies: 'Caddies', carts: 'Carts',
};
/** The first sentence or two of a description, cut at a sentence end around 300 characters. */
function brief(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= 320) return t;
  const cut = t.slice(0, 320);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '));
  return end > 120 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/** "Tpc Scottsdale" → "TPC Scottsdale". */
const tidy = (n: string) => n.trim().replace(/\b(Tpc|Cc|Gc|Pga|Usga)\b/g, (m) => m.toUpperCase());

export function accessOf(t: string | null | undefined): CourseAccess {
  const s = (t || '').toLowerCase().replace(/[\s_]+/g, '-');
  if (s.startsWith('semi')) return 'semi-private';
  if (s.includes('private')) return 'private';
  if (s.includes('resort')) return 'resort';
  if (s.includes('municipal') || s.includes('city') || s.includes('county')) return 'municipal';
  if (s.includes('public') || s.includes('daily')) return 'public';
  return '';
}

async function get<T>(path: string, revalidate: number): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { 'User-Agent': UA, Accept: 'application/json' }, next: { revalidate } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch { return null; }
}

/** Courses matching a name, US only, nearest to `near` first when given. */
export async function searchCourses(q: string, near?: { lat: number; lon: number } | null, limit = 8): Promise<CourseHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  const j = await get<{ courses?: RawHit[] }>(`/v1/courses/search?q=${encodeURIComponent(query)}`, 60 * 60 * 24 * 7);
  const hits = (j?.courses || [])
    .filter((c) => c.state && Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && !/practice|driving range|putting/i.test(c.name))
    .map((c) => ({
      id: c.id, name: tidy(c.course_name || c.name), city: c.city || '', state: c.state || '', access: accessOf(c.type),
      lat: c.latitude, lon: c.longitude, website: c.website || '',
      miles: near ? Math.round(miles(near.lat, near.lon, c.latitude, c.longitude)) : undefined,
    }));
  if (near) hits.sort((a, b) => (a.miles ?? 0) - (b.miles ?? 0));
  // The same course listed twice ("Pine Needles" and "Pine Needles Lodge Golf Club" at one spot): keep the first.
  const out: CourseHit[] = [];
  for (const h of hits) {
    const w = words(h.name);
    const dup = out.some((o) => miles(o.lat, o.lon, h.lat, h.lon) < 1 && (() => { const ow = words(o.name); return ow.every((x) => w.includes(x)) || w.every((x) => ow.includes(x)); })());
    if (!dup) out.push(h);
  }
  return out.slice(0, limit);
}

/** Full details for one course: type, location, par, and course rating / slope by tee. */
export async function courseDetail(id: string): Promise<CourseInfo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const d = await get<RawDetail>(`/api/v1/courses/${id}`, 60 * 60 * 24 * 30);
  if (!d || !Number.isFinite(d.lat)) return null;
  const tees = (d.tees || [])
    .filter((t) => (t.gender || 'Male') === 'Male' && Number(t.course_rating) > 0 && Number(t.slope) > 0)
    .map((t) => ({ name: t.tee_name || '', yards: Number(t.yardage) || 0, rating: Number(t.course_rating), slope: Number(t.slope) }))
    .sort((a, b) => b.yards - a.yards);
  return {
    id: d.id, name: tidy(d.course_name), city: d.city || '', state: d.state || '', access: accessOf(d.type), lat: d.lat, lon: d.lng,
    par: d.par || 0, holes: d.holes || 0, yards: d.yardage || 0, website: d.website || '', phone: d.phone || '', tees,
    architect: d.architect || '', built: d.year_built || 0,
    description: d.description ? brief(d.description) : '',
    descriptionUrl: d.description_source?.url || '',
    facilities: Object.entries(d.facilities || {}).filter(([k, v]) => v === true && FACILITY[k]).map(([k]) => FACILITY[k]),
  };
}

const GENERIC = new Set(['the', 'golf', 'club', 'course', 'courses', 'country', 'cc', 'gc', 'resort', 'links', 'and', 'at', 'of', 'inn', 'lodge', 'national']);
const words = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w && !GENERIC.has(w));

/** Best database match for a course name typed by someone, near the trip's destination (within ~120 miles). */
export async function matchCourse(name: string, near: { lat: number; lon: number }): Promise<CourseHit | null> {
  const base = name.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const inside = (name.match(/\((.*?)\)/) || [])[1] || '';
  const want = words(base);
  if (!want.length) return null;
  const hits = (await searchCourses(base, near, 20)).filter((h) => (h.miles ?? 0) <= 120);
  // Every meaningful word of the name must appear in the database name (or the other way round for short names).
  const fits = hits.filter((h) => {
    const have = words(h.name);
    return want.every((w) => have.includes(w)) || (have.length > 0 && have.every((w) => want.includes(w)));
  });
  if (!fits.length) return null;
  // "Whistling Straits (Irish)": prefer the database course that mentions "Irish".
  const sub = words(inside);
  return (sub.length && fits.find((h) => sub.every((w) => words(h.name).includes(w)))) || fits[0];
}
