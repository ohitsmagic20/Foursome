import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { db, HttpError, newToken } from './server';
import type { Profile } from './shared';

// Accounts. Supabase Auth only sends and checks the 6-digit email code; after that the app
// keeps its own long-lived session token on the phone (same model as trip tokens).

export const PROFILE_COLS = 'id,email,name,phone,home_city,airport,budget,bed';

/** A throwaway Auth client per request, so a signed-in user's session never leaks into the shared server client. */
function authClient() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !key) throw new HttpError(500, 'The server is missing its Supabase settings.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export function cleanEmail(v: unknown): string {
  const e = typeof v === 'string' ? v.trim().toLowerCase().slice(0, 200) : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, 'Enter a valid email address.');
  return e;
}

export async function sendCode(email: string) {
  const { error } = await authClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (!error) return;
  const msg = error.message || '';
  if (/not authorized/i.test(msg)) {
    throw new HttpError(400, 'Sign-in emails can only go to the app owner’s team right now. The owner needs to set up a custom email sender in Supabase.');
  }
  if (/rate limit|too many|seconds/i.test(msg) || error.status === 429) {
    throw new HttpError(429, 'Too many sign-in emails were sent. Wait a minute and try again.');
  }
  throw new HttpError(400, `Couldn’t send the code: ${msg}`);
}

export async function verifyCode(email: string, code: string): Promise<{ profile: Profile; session: string; isNew: boolean }> {
  const token = code.replace(/\D/g, '');
  if (token.length < 6) throw new HttpError(400, 'Enter the 6-digit code from the email.');
  const { data, error } = await authClient().auth.verifyOtp({ email, token, type: 'email' });
  if (error || !data.user) throw new HttpError(400, 'That code didn’t work. Check the newest email, or send a new code.');
  const userId = data.user.id;

  let { data: profile, error: pErr } = await db().from('profiles').select(PROFILE_COLS).eq('id', userId).maybeSingle();
  if (pErr) throw pErr;
  let isNew = false;
  if (!profile) {
    const ins = await db().from('profiles').insert({ id: userId, email }).select(PROFILE_COLS).single();
    if (ins.error) throw ins.error;
    profile = ins.data;
    isNew = true;
  }
  const session = newToken();
  const s = await db().from('sessions').insert({ token: session, profile_id: userId });
  if (s.error) throw s.error;
  return { profile: profile as Profile, session, isNew };
}

/** The signed-in person, from the `x-session` header. */
export async function profileFromRequest(req: Request, required: true): Promise<Profile>;
export async function profileFromRequest(req: Request, required?: false): Promise<Profile | null>;
export async function profileFromRequest(req: Request, required = false): Promise<Profile | null> {
  const token = req.headers.get('x-session') || '';
  if (token) {
    const { data, error } = await db().from('sessions').select(`profile_id, profiles(${PROFILE_COLS})`).eq('token', token).maybeSingle();
    if (error && !/sessions/.test(error.message)) throw error; // table not created yet → treat as signed out
    const p = (data as unknown as { profiles?: Profile } | null)?.profiles;
    if (p) return p;
  }
  if (required) throw new HttpError(401, 'Sign in first.');
  return null;
}

export const profileComplete = (p: Profile) => !!p.name.trim() && p.airport.length === 3;
