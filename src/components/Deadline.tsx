'use client';

import { useState } from 'react';
import type { Kind } from '@/lib/shared';
import { isoDay, addDays, lockedOf, optionsOf } from '@/lib/shared';
import { useTrip, type TripCtx } from './ui';

type DKind = 'date' | 'destination' | 'lodging';
const CLOSE_HOUR = 21; // voting closes at 9 PM on the chosen day, in the organizer's time

function closesLabel(iso: string): string {
  const at = new Date(iso);
  const days = Math.round((new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime() - new Date().setHours(0, 0, 0, 0)) / 864e5);
  const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: at.getMinutes() ? '2-digit' : undefined });
  if (days <= 0) return `Voting closes tonight at ${time}`;
  if (days === 1) return `Voting closes tomorrow at ${time}`;
  return `Voting closes ${at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;
}

/** "Voting closes Fri, Nov 13" for everyone; organizers can set or change it. */
export function Deadline({ kind }: { kind: DKind }) {
  const ctx = useTrip();
  const { state, me } = ctx;
  if (!('deadlines' in state.trip)) return null; // database not updated yet
  if (lockedOf(state, kind as Kind) || !optionsOf(state, kind as Kind).length) return null;
  const at = state.trip.deadlines?.[kind];
  const soon = at ? Date.parse(at) - Date.now() < 36 * 3600000 : false;
  if (!at && !me?.is_organizer) return null;
  return (
    <div className={`deadline${soon ? ' soon' : ''}`}>
      {at ? <span>{closesLabel(at)}. The leader locks in then.</span> : <span className="row-meta">No deadline. Voting stays open until you lock a winner.</span>}
      {me?.is_organizer && <button type="button" className="link-btn" onClick={() => deadlineSheet(ctx, kind, at)}>{at ? 'Change' : 'Set a deadline'}</button>}
    </div>
  );
}

function DeadlineForm({ ctx, kind, at }: { ctx: TripCtx; kind: DKind; at?: string }) {
  const [day, setDay] = useState(at ? isoDay(new Date(at)) : isoDay(addDays(new Date(), 3)));
  const [busy, setBusy] = useState(false);
  const min = isoDay(addDays(new Date(), 1));
  const save = async (value: string | null) => {
    setBusy(true);
    let iso: string | null = null;
    if (value) { const [y, m, d] = value.split('-').map(Number); iso = new Date(y, m - 1, d, CLOSE_HOUR).toISOString(); }
    const ok = await ctx.act('set_deadline', { kind, at: iso, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    setBusy(false);
    if (ok) { ctx.sheet(null); ctx.toast(value ? 'Deadline set. Everyone’s been told.' : 'Deadline removed'); }
  };
  return (
    <form className="form" onSubmit={(e) => { e.preventDefault(); save(day); }}>
      <div className="field">
        <label htmlFor="dl-day">Voting closes</label>
        <input id="dl-day" type="date" min={min} required value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      <p className="hint">At 9 PM that day, whatever’s leading gets locked in. If it’s a tie, you pick. People who haven’t voted get a reminder the day before.</p>
      <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Set deadline'}</button>
      {at && <button type="button" className="btn ghost block" disabled={busy} onClick={() => save(null)}>Remove deadline</button>}
    </form>
  );
}

const TITLE: Record<DKind, string> = { date: 'Deadline for dates', destination: 'Deadline for where to go', lodging: 'Deadline for where to stay' };
function deadlineSheet(ctx: TripCtx, kind: DKind, at?: string) {
  ctx.sheet({ title: TITLE[kind], body: <DeadlineForm ctx={ctx} kind={kind} at={at} /> });
}
