import 'server-only';
import type { Kind, Trip } from './shared';
import { leaderOf, openVotes, rangeLabel, tally, nightsOf } from './shared';
import { db, firstIn, loadState } from './server';
import { notify } from './push';
import { APP_URL, emailMembers } from './email';

export const DEADLINE_KINDS = ['date', 'destination', 'lodging'] as const;
export type DeadlineKind = (typeof DEADLINE_KINDS)[number];
const TAB: Record<DeadlineKind, string> = { date: 'vote', destination: 'vote', lodging: 'stay' };
export const DECISION: Record<DeadlineKind, string> = { date: 'dates', destination: 'where to go', lodging: 'where to stay' };

function labelOf(kind: Kind, data: Record<string, unknown>, trip: Trip): string {
  if (kind === 'date') return rangeLabel(String(data.start), nightsOf(trip, data as { start: string; nights?: number }));
  return String(data.name || '');
}

async function saveDeadlines(trip: Trip, next: Trip['deadlines']) {
  await db().from('trips').update({ deadlines: next || {} }).eq('id', trip.id);
  trip.deadlines = next;
}

/** Close any voting whose deadline has passed: lock the leader (or tell the organizer about a tie). */
export async function settleDeadlines(trip: Trip): Promise<boolean> {
  const due = DEADLINE_KINDS.filter((k) => trip.deadlines?.[k] && Date.parse(trip.deadlines[k]!) <= Date.now());
  if (!due.length) return false;
  const state = await loadState(trip, null);
  const everyone = state.members.map((m) => m.id);
  const organizers = state.members.filter((m) => m.is_organizer).map((m) => m.id);
  const next = { ...trip.deadlines };
  let changed = false;
  for (const kind of due) {
    delete next[kind];
    // Only one request gets to close each deadline, so nobody hears about it twice.
    if (!(await firstIn(`deadline:${trip.id}:${kind}:${trip.deadlines![kind]}`, 24 * 60))) continue;
    if (state.options.some((o) => o.kind === kind && o.locked)) continue;
    const opts = state.options.filter((o) => o.kind === kind);
    const leader = leaderOf<Record<string, unknown>>(state, kind);
    if (!leader || tally(state, leader.id).yes === 0) continue;
    const top = tally(state, leader.id).score;
    const tied = opts.filter((o) => tally(state, o.id).score === top).length > 1;
    const url = `/t/${trip.code}#${TAB[kind]}`;
    if (tied) {
      await notify(trip.id, organizers, { title: trip.name, body: `Voting on ${DECISION[kind]} closed in a tie. Pick the winner.`, url, tag: `deadline-${kind}` });
      await emailMembers(organizers, { subject: `${trip.name}: it’s a tie on ${DECISION[kind]}`, heading: `Voting on ${DECISION[kind]} closed in a tie`, lines: ['Open the trip and lock the one you want.'], button: { label: 'Pick the winner', url: `${APP_URL}${url}` } });
      continue;
    }
    await db().from('options').update({ locked: false }).eq('trip_id', trip.id).eq('kind', kind);
    await db().from('options').update({ locked: true }).eq('id', leader.id);
    changed = true;
    const what = labelOf(kind, leader.data, trip);
    const text = kind === 'lodging' ? `Voting closed: you’re staying at ${what}.` : `Voting closed: ${what} it is.`;
    await notify(trip.id, everyone, { title: trip.name, body: text, url, tag: `lock-${kind}` });
    await emailMembers(everyone, { subject: `${trip.name}: ${text}`, heading: text, lines: [`The deadline for ${DECISION[kind]} passed and ${what} had the most votes, so it’s locked in.`], button: { label: 'Open the trip', url: `${APP_URL}${url}` } });
  }
  await saveDeadlines(trip, next);
  return changed;
}

/** The day before a deadline: remind the people who haven't voted on that decision. Run daily. */
export async function remindDeadlines(): Promise<number> {
  const { data, error } = await db().from('trips').select('id,code,name,nights,food,deadlines').order('created_at', { ascending: false }).limit(1000);
  if (error) return 0;
  let sent = 0;
  for (const trip of ((data || []) as Trip[]).filter((t) => t.deadlines && Object.keys(t.deadlines).length)) {
    await settleDeadlines(trip);
    for (const kind of DEADLINE_KINDS) {
      const at = trip.deadlines?.[kind];
      if (!at) continue;
      const left = Date.parse(at) - Date.now();
      if (left <= 0 || left > 36 * 3600000) continue;
      if (!(await firstIn(`deadline-remind:${trip.id}:${kind}:${at}`, 3 * 24 * 60))) continue;
      const state = await loadState(trip, null);
      const waiting = state.members.filter((m) => openVotes({ ...state, meId: m.id })[kind] > 0).map((m) => m.id);
      if (!waiting.length) continue;
      const url = `/t/${trip.code}#${TAB[kind]}`;
      const body = `Voting on ${DECISION[kind]} closes tomorrow. Get your vote in.`;
      await notify(trip.id, waiting, { title: trip.name, body, url, tag: `deadline-${kind}` });
      sent += await emailMembers(waiting, { subject: `${trip.name}: ${body}`, heading: body, lines: ['After that, the leading option is locked in automatically.'], button: { label: 'Vote now', url: `${APP_URL}${url}` } });
    }
  }
  return sent;
}
