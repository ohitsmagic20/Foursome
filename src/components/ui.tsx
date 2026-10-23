'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Member, Option, TripState, VoteValue } from '@/lib/shared';
import { formatTee, parseTee, tally, votesFor } from '@/lib/shared';
import { firstName } from '@/lib/client';

/* ---------- icons ---------- */
const sv = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const Icon = {
  trip: <svg viewBox="0 0 24 24" {...sv}><path d="M6 21V3" /><path d="M6 4h11l-3 4 3 4H6" /><ellipse cx="9" cy="21" rx="6" ry="1.2" /></svg>,
  vote: <svg viewBox="0 0 24 24" {...sv}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>,
  stay: <svg viewBox="0 0 24 24" {...sv}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9.5 20v-5h5v5" /></svg>,
  golf: <svg viewBox="0 0 24 24" {...sv}><circle cx="12" cy="9" r="6" /><circle cx="10" cy="7.5" r=".6" fill="currentColor" /><circle cx="13.5" cy="8" r=".6" fill="currentColor" /><circle cx="11.5" cy="10.5" r=".6" fill="currentColor" /><path d="M10 15h4l-1 6h-2Z" /></svg>,
  flights: <svg viewBox="0 0 24 24" {...sv}><path d="M10.5 13.5 4 12l-1.5 1.5 5 2.5 2.5 5L11.5 19 10 12.5l4.5-4.5c1.4-1.4 3.6-2.6 4.5-1.7.9.9-.3 3.1-1.7 4.5L12.8 15.3" /><path d="M14 8 6.5 5.5 5 7l6 3.5" /></svg>,
  edit: <svg viewBox="0 0 24 24" {...sv} strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
  info: <svg viewBox="0 0 24 24" {...sv} strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" {...sv} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>,
  chev: <svg className="chev" width="16" height="16" viewBox="0 0 24 24" {...sv} strokeWidth={2.2}><path d="m9 6 6 6-6 6" /></svg>,
  lock: <svg width="14" height="14" viewBox="0 0 24 24" {...sv} strokeWidth={2.2}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
};

export function Chip({ kind, children }: { kind: 'good' | 'warn' | 'bad' | 'flag' | 'plain'; children: ReactNode }) {
  return <span className={`chip ${kind}`}>{children}</span>;
}
export function Callout({ kind = '', children }: { kind?: '' | 'warn' | 'bad' | 'good'; children: ReactNode }) {
  return <div className={`callout ${kind}`}>{Icon.info}<div>{children}</div></div>;
}

/* ---------- trip context ---------- */
export interface TripCtx {
  state: TripState;
  me: Member | null;
  act: (type: string, payload?: Record<string, unknown>) => Promise<boolean>;
  vote: (optionId: string, value: VoteValue | null) => void;
  toast: (msg: string) => void;
  sheet: (s: SheetSpec | null) => void;
  go: (tab: TabId) => void;
}
export type TabId = 'trip' | 'vote' | 'stay' | 'golf' | 'flights';
export interface SheetSpec { title: string; body: ReactNode }
export const Ctx = createContext<TripCtx | null>(null);
export function useTrip(): TripCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useTrip outside provider');
  return c;
}

/* ---------- sheet ---------- */
export function Sheet({ spec, onClose }: { spec: SheetSpec | null; onClose: () => void }) {
  useEffect(() => {
    if (!spec) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, [spec, onClose]);
  if (!spec) return null;
  return (
    <div className="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={spec.title}>
        <div className="grabber" />
        <div className="sheet-head"><h2>{spec.title}</h2><button className="btn small ghost" onClick={onClose}>Cancel</button></div>
        {spec.body}
      </div>
    </div>
  );
}

/** A form inside a sheet: handles busy state and server errors. */
export function SheetForm({ children, submit, onSubmit, extra }: {
  children: ReactNode; submit: string; onSubmit: (fd: Record<string, string>) => Promise<boolean | void>; extra?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      setErr('');
      setBusy(true);
      try {
        const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
        await onSubmit(fd);
      } catch (x) {
        setErr(x instanceof Error ? x.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }
    }}>
      {children}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="btn-row" style={{ marginTop: 4 }}>
        <button className="btn primary" style={{ flex: 1 }} type="submit" disabled={busy}>{busy ? <span className="spinner" /> : submit}</button>
        {extra}
      </div>
    </form>
  );
}

export function Field({ name, label, defaultValue, type = 'text', ...rest }: {
  name: string; label: string; defaultValue?: string | number | null; type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} type={type} defaultValue={defaultValue ?? ''}
        {...(type === 'number' ? { inputMode: 'decimal' as const, min: 0, step: 'any' } : {})} {...rest} />
    </div>
  );
}
export function Select({ name, label, defaultValue, options }: { name: string; label: string; defaultValue?: string | number; options: [string | number, string][] }) {
  return (
    <div className="field">
      <label htmlFor={`f-${name}`}>{label}</label>
      <select id={`f-${name}`} name={name} defaultValue={defaultValue}>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </div>
  );
}

/* ---------- voting ---------- */
export function VoteControl({ option }: { option: Option }) {
  const { state, me, vote } = useTrip();
  if (!me) return null;
  const mine = votesFor(state, option.id)[me.id];
  const choices: [VoteValue, string][] = [['yes', 'In'], ['maybe', 'Maybe'], ['no', 'Out']];
  return (
    <div className="seg" role="group" aria-label="Your vote">
      {choices.map(([v, t]) => (
        <button key={v} type="button" className={v} aria-pressed={mine === v} onClick={() => vote(option.id, mine === v ? null : v)}>{t}</button>
      ))}
    </div>
  );
}

export function Tally({ option }: { option: Option }) {
  const { state } = useTrip();
  const vs = votesFor(state, option.id);
  const names = (val: VoteValue) => state.members.filter((m) => vs[m.id] === val).map((m) => firstName(m.name));
  const waiting = state.members.filter((m) => !vs[m.id]).map((m) => firstName(m.name));
  const parts: [string, string[]][] = [['In', names('yes')], ['Maybe', names('maybe')], ['Out', names('no')], ['Waiting on', waiting]];
  return (
    <div className="voters">
      {parts.filter(([, n]) => n.length).map(([k, n], i) => <span key={k}>{i ? ' · ' : ''}<b>{k}</b> {n.join(', ')}</span>)}
    </div>
  );
}

/** Lock / unlock button, shown to the organizer only. */
export function LockButton({ option, lockLabel = 'Lock it in', unlockLabel = 'Unlock' }: { option: Option; lockLabel?: string; unlockLabel?: string }) {
  const { me, act, toast } = useTrip();
  if (!me?.is_organizer) return null;
  return option.locked
    ? <button className="btn small ghost" onClick={() => act('unlock', { optionId: option.id })}>{unlockLabel}</button>
    : <button className="btn small" onClick={async () => { if (await act('lock', { optionId: option.id })) toast('Locked in. Everyone will see it.'); }}>{Icon.lock} {lockLabel}</button>;
}

export function canEdit(me: Member | null, option: Option) {
  return !!me && (me.is_organizer || option.created_by === me.id);
}

/* ---------- confirm-in-place ---------- */
export function ConfirmButton({ label, confirmLabel = 'Tap again to confirm', onConfirm, className = 'btn danger' }: {
  label: string; confirmLabel?: string; onConfirm: () => void; className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return <button type="button" className={className} onClick={() => (armed ? onConfirm() : setArmed(true))}>{armed ? confirmLabel : label}</button>;
}

/* ---------- tee time picker ---------- */
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const QUICK = ['7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:30 PM', '1:30 PM'];

/** Hour, minute and AM/PM as separate pieces, so changing one never means retyping the rest.
 *  Submits as a single "11:14 AM" string under `name`. */
export function TimeField({ name, label, defaultValue, hint }: { name: string; label: string; defaultValue?: string; hint?: string }) {
  const init = parseTee(defaultValue);
  const [h, setH] = useState(init.h);
  const [m, setM] = useState(init.m);
  const [ap, setAp] = useState<'AM' | 'PM'>(init.ap);
  const value = formatTee(h, m, ap);
  return (
    <div className="field">
      <label htmlFor={`f-${name}-h`}>{label}</label>
      <input type="hidden" name={name} value={value} />
      <div className="time-picker">
        <select id={`f-${name}-h`} aria-label="Hour" value={h} onChange={(e) => setH(Number(e.target.value))}>
          {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <span className="colon" aria-hidden="true">:</span>
        <select aria-label="Minute" value={m} onChange={(e) => setM(Number(e.target.value))}>
          {MINUTES.map((x) => <option key={x} value={x}>{String(x).padStart(2, '0')}</option>)}
        </select>
        <div className="seg ampm" role="group" aria-label="AM or PM">
          {(['AM', 'PM'] as const).map((x) => <button key={x} type="button" aria-pressed={ap === x} onClick={() => setAp(x)}>{x}</button>)}
        </div>
      </div>
      <div className="quick-times" aria-label="Common tee times">
        {QUICK.map((t) => (
          <button key={t} type="button" className={t === value ? 'on' : ''} onClick={() => { const p = parseTee(t); setH(p.h); setM(p.m); setAp(p.ap); }}>
            {t.replace(':00', '').replace(' ', '')}
          </button>
        ))}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}
