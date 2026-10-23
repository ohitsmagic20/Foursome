import 'server-only';
import { createHmac } from 'node:crypto';
import { db } from './server';
import type { DateData, DestinationData, LodgingData, TripState } from './shared';
import { costOf, dayLabel, groupNames, money, nightsOf, pickOf, plannedRounds, rangeLabel, teeAfter } from './shared';

// Trip emails (reminders, "it's locked", the final plan) sent through Resend's API.
// Only people with an account get them, and only while "Trip emails" is on in their profile.
// Without RESEND_API_KEY in the server environment, nothing is sent.

export const APP_URL = (process.env.APP_URL || 'https://www.foresomes.net').replace(/\/+$/, '');
const FROM = process.env.EMAIL_FROM || 'Foresome <noreply@foresomes.net>';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function signingKey() {
  return process.env.CRON_SECRET || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || 'foresome';
}
/** A key that lets an email's unsubscribe link work without signing in. */
export const unsubscribeKey = (profileId: string) => createHmac('sha256', signingKey()).update(`unsub:${profileId}`).digest('base64url').slice(0, 24);
const unsubscribeUrl = (profileId: string) => `${APP_URL}/unsubscribe?p=${profileId}&k=${unsubscribeKey(profileId)}`;

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

export interface EmailBody {
  subject: string;
  heading: string;
  /** Plain paragraphs or "label: value" lines. */
  lines: string[];
  button?: { label: string; url: string };
}

function render(b: EmailBody, unsub: string) {
  const html = `<!doctype html><html><body style="margin:0;background:#f2f4ee;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#17231b">
<div style="max-width:520px;margin:0 auto;padding:28px 20px">
<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#4c6b55;font-weight:700">Foresome</div>
<h1 style="font-size:22px;margin:8px 0 16px">${esc(b.heading)}</h1>
${b.lines.map((l) => `<p style="font-size:15px;line-height:1.5;margin:0 0 10px">${esc(l)}</p>`).join('\n')}
${b.button ? `<p style="margin:20px 0"><a href="${esc(b.button.url)}" style="display:inline-block;background:#1f5135;color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:10px">${esc(b.button.label)}</a></p>` : ''}
<p style="font-size:12px;color:#6b776f;margin-top:28px">You’re getting this because you’re on a Foresome trip. <a href="${esc(unsub)}" style="color:#6b776f">Turn off trip emails</a>.</p>
</div></body></html>`;
  const text = [b.heading, '', ...b.lines, ...(b.button ? ['', `${b.button.label}: ${b.button.url}`] : []), '', `Turn off trip emails: ${unsub}`].join('\n');
  return { html, text };
}

async function send(to: string, b: EmailBody, profileId: string) {
  const unsub = unsubscribeUrl(profileId);
  const { html, text } = render(b, unsub);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM, to: [to], subject: b.subject, html, text,
      headers: { 'List-Unsubscribe': `<${APP_URL}/api/unsubscribe?p=${profileId}&k=${unsubscribeKey(profileId)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    }),
  });
  if (!res.ok) console.error('email failed', res.status, (await res.text()).slice(0, 200));
  return res.ok;
}

/** A plain notice to the app owner (no unsubscribe: it's operational). */
export async function emailOwner(to: string[], subject: string, lines: string[]) {
  if (!emailEnabled() || !to.length) return false;
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5">${lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join('')}</div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html, text: lines.join('\n') }),
  });
  return res.ok;
}

/** Email trip members who have an account and trip emails on. Returns how many were sent. */
export async function emailMembers(memberIds: string[], b: EmailBody | ((memberId: string) => EmailBody)): Promise<number> {
  if (!emailEnabled() || !memberIds.length) return 0;
  const { data, error } = await db().from('members').select('id, profiles(id,email,email_updates)').in('id', memberIds).not('profile_id', 'is', null);
  if (error) { console.error('email lookup failed', error.message); return 0; }
  type Row = { id: string; profiles: { id: string; email: string; email_updates?: boolean } | null };
  let sent = 0;
  for (const r of (data || []) as unknown as Row[]) {
    const p = r.profiles;
    if (!p?.email || p.email_updates === false) continue;
    if (await send(p.email, typeof b === 'function' ? b(r.id) : b, p.id)) sent++;
  }
  return sent;
}

/** Who can be reached by email on this trip (for the organizer's button). */
export async function emailableCount(memberIds: string[]): Promise<number> {
  if (!emailEnabled() || !memberIds.length) return 0;
  const { data } = await db().from('members').select('id, profiles(email_updates)').in('id', memberIds).not('profile_id', 'is', null);
  return ((data || []) as unknown as { profiles: { email_updates?: boolean } | null }[]).filter((r) => r.profiles && r.profiles.email_updates !== false).length;
}

/** The trip plan as email lines, personalized with that person's estimated cost. */
export function planEmail(state: TripState, memberId: string): EmailBody {
  const trip = state.trip;
  const date = pickOf<DateData>(state, 'date');
  const dest = pickOf<DestinationData>(state, 'destination');
  const stay = pickOf<LodgingData>(state, 'lodging');
  const tag = (locked: boolean) => (locked ? '' : ' (still voting)');
  const lines: string[] = [];
  lines.push(date.option ? `When: ${rangeLabel(date.option.data.start, nightsOf(trip, date.option.data))}${tag(date.locked)}` : 'When: not decided yet');
  lines.push(dest.option ? `Where: ${dest.option.data.name}${dest.option.data.airport ? ` (fly into ${(dest.option.data.airports || [dest.option.data.airport]).join(' or ')})` : ''}${tag(dest.locked)}` : 'Where: not decided yet');
  lines.push(stay.option ? `Staying: ${stay.option.data.name}${stay.option.data.url ? ` – ${stay.option.data.url}` : ''}${tag(stay.locked)}` : 'Staying: not decided yet');
  const rounds = plannedRounds(state).slice().sort((a, b) => a.data.day - b.data.day);
  if (rounds.length) {
    for (const r of rounds) {
      const when = date.option ? dayLabel(date.option.data.start, r.data.day) : `Day ${r.data.day}`;
      const names = groupNames(state, r.data.groups).map((g, i) => `${teeAfter(r.data.time, i)} ${g}`);
      lines.push(`Golf: ${when}, ${r.data.time} at ${r.data.course}${r.data.fee ? ` (${money(r.data.fee)})` : ''}${r.data.booked ? '' : ' – not booked yet'}${names.length ? `. Groups: ${names.join('; ')}` : ''}`);
    }
  } else lines.push('Golf: no rounds in the plan yet');
  const me = state.members.find((m) => m.id === memberId);
  if (me) {
    const c = costOf(state, me);
    lines.push(`Your estimated cost: ${money(c.total)} (flight ${c.flight ? money(c.flight) : 'not set'}, stay ${money(c.stay)}, golf ${money(c.golf)}${c.food ? `, food ${money(c.food)}` : ''})`);
    lines.push(me.flight_summary ? `Your flight: ${me.flight_summary}` : 'You haven’t added a flight yet.');
  }
  lines.push(`Going: ${state.members.map((m) => m.name).join(', ')}`);
  return { subject: `${trip.name}: the plan`, heading: `${trip.name}: the plan`, lines, button: { label: 'Open the trip', url: `${APP_URL}/t/${trip.code}` } };
}
