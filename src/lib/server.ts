import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import type { Member, Option, Trip, TripState, Vote } from './shared';

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !key) throw new HttpError(500, 'The server is missing SUPABASE_URL or SUPABASE_SECRET_KEY. Add them to your environment variables.');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: `Something went wrong on the server: ${explain(e)}` }, { status: 500 });
  });
}

/** Turn a database or network error into a message that says what to fix. Never includes keys. */
export function explain(e: unknown): string {
  const err = (e && typeof e === 'object' ? e : {}) as { message?: string; code?: string; cause?: { code?: string; message?: string } };
  const msg = String(err.message || e || '');
  if (err.code === 'PGRST205' || /schema cache/i.test(msg)) {
    return `the database can't see the tables yet (${err.code || 'schema cache'}). In the Supabase SQL Editor, run: notify pgrst, 'reload schema';`;
  }
  if (err.code === '42P01' || /relation .* does not exist|Could not find the table/i.test(msg)) {
    return 'the database tables are missing. Run supabase/schema.sql in the Supabase SQL Editor for this project.';
  }
  if (err.code === '42501' || /permission denied/i.test(msg)) {
    return `the server key isn't allowed to use the tables (${msg.slice(0, 80)}).`;
  }
  if (/Invalid API key|JWT|apikey|Unauthorized|invalid.*key/i.test(msg)) {
    return 'Supabase rejected the key. Check that SUPABASE_SECRET_KEY is the secret (sb_secret_...) or service_role key, with no spaces.';
  }
  if (/fetch failed|ENOTFOUND|getaddrinfo|Invalid URL|ECONNREFUSED/i.test(msg + (err.cause?.code || '') + (err.cause?.message || ''))) {
    return 'the server could not reach Supabase. Check that SUPABASE_URL looks like https://abcd.supabase.co with nothing after .co.';
  }
  return msg.slice(0, 200) || 'unknown error';
}

/** Short, readable, hard to guess. No 0/O/1/l. */
export function newCode(len = 8): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => abc[b % abc.length]).join('');
}
export const newToken = () => randomBytes(24).toString('base64url');

/* ---------- input cleaning ---------- */
export function str(v: unknown, max = 120, fallback = ''): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : fallback;
}
export function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
export function bed(v: unknown): 'own' | 'share' {
  return v === 'share' ? 'share' : 'own';
}
export function airport(v: unknown): string {
  return str(v, 3).toUpperCase().replace(/[^A-Z]/g, '');
}
export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const j = await req.json();
    return j && typeof j === 'object' ? (j as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/* ---------- loading ---------- */
const MEMBER_COLS = 'id,name,airport,budget,bed,is_organizer,paid,flight_price,flight_summary,flight_arrive_at,flight_depart_at';

export async function tripByCode(code: string): Promise<Trip> {
  const { data, error } = await db().from('trips').select('id,code,name,nights,deposit,food').eq('code', code).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'This trip link is not valid. Ask the organizer to send it again.');
  return data as Trip;
}

export async function memberFromRequest(req: Request, tripId: string, required: true): Promise<Member>;
export async function memberFromRequest(req: Request, tripId: string, required?: false): Promise<Member | null>;
export async function memberFromRequest(req: Request, tripId: string, required = false): Promise<Member | null> {
  const token = req.headers.get('x-member-token') || '';
  if (!token) {
    if (required) throw new HttpError(401, 'Join the trip first.');
    return null;
  }
  const { data, error } = await db().from('members').select(MEMBER_COLS).eq('trip_id', tripId).eq('token', token).maybeSingle();
  if (error) throw error;
  if (!data && required) throw new HttpError(401, 'You are not on this trip on this device. Open the invite link and join again.');
  return (data as Member) || null;
}

export async function loadState(trip: Trip, me: Member | null): Promise<TripState> {
  const [m, o] = await Promise.all([
    db().from('members').select(MEMBER_COLS).eq('trip_id', trip.id).order('created_at'),
    db().from('options').select('id,kind,data,locked,created_by').eq('trip_id', trip.id).order('created_at'),
  ]);
  if (m.error) throw m.error;
  if (o.error) throw o.error;
  const options = (o.data || []) as Option[];
  let votes: Vote[] = [];
  if (options.length) {
    const v = await db().from('votes').select('option_id,member_id,value').in('option_id', options.map((x) => x.id));
    if (v.error) throw v.error;
    votes = (v.data || []) as Vote[];
  }
  return { trip, members: (m.data || []) as Member[], options, votes, meId: me?.id ?? null };
}
