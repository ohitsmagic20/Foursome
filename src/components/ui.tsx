'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { OutboxItem } from '@/lib/outbox';
import type { Member, Option, TripState, VoteValue } from '@/lib/shared';
import { andList, formatTee, parseTee, votesFor , TIER_HINT, priceTier } from '@/lib/shared';
import { firstName, initials } from '@/lib/client';

/* ---------- icons ---------- */
const sv = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const Icon = {
  trip: <svg viewBox="0 0 24 24" {...sv}><path d="M6 21V3" /><path d="M6 4h11l-3 4 3 4H6" /><ellipse cx="9" cy="21" rx="6" ry="1.2" /></svg>,
  vote: <svg viewBox="0 0 24 24" {...sv}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" /><circle cx="12" cy="10" r="2.4" /></svg>,
  stay: <svg viewBox="0 0 24 24" {...sv}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h14V10" /><path d="M9.5 20v-5h5v5" /></svg>,
  golf: <svg viewBox="0 0 24 24" {...sv}><circle cx="12" cy="9" r="6" /><circle cx="10" cy="7.5" r=".6" fill="currentColor" /><circle cx="13.5" cy="8" r=".6" fill="currentColor" /><circle cx="11.5" cy="10.5" r=".6" fill="currentColor" /><path d="M10 15h4l-1 6h-2Z" /></svg>,
  doc: <svg viewBox="0 0 24 24" {...sv}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg>,
  pin: <svg viewBox="0 0 24 24" {...sv}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></svg>,
  calendar: <svg viewBox="0 0 24 24" {...sv}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  cup: <svg viewBox="0 0 24 24" {...sv}><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 4.4M17 6h2.5a2.5 2.5 0 0 1-2.6 4.4" /><path d="M12 14v3.5M8.5 20.5h7l-1-3h-5Z" /></svg>,
  flights: <svg viewBox="0 0 24 24" {...sv}><path d="M10.5 13.5 4 12l-1.5 1.5 5 2.5 2.5 5L11.5 19 10 12.5l4.5-4.5c1.4-1.4 3.6-2.6 4.5-1.7.9.9-.3 3.1-1.7 4.5L12.8 15.3" /><path d="M14 8 6.5 5.5 5 7l6 3.5" /></svg>,
  edit: <svg viewBox="0 0 24 24" {...sv} strokeWidth={2}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>,
  clock: <svg width="14" height="14" viewBox="0 0 24 24" {...sv} strokeWidth={2.2}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  info: <svg viewBox="0 0 24 24" {...sv} strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>,
  plus: <svg width="16" height="16" viewBox="0 0 24 24" {...sv} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></svg>,
  down: <svg className="down" width="14" height="14" viewBox="0 0 24 24" {...sv} strokeWidth={2.4}><path d="m6 9 6 6 6-6" /></svg>,
  chev: <svg className="chev" width="16" height="16" viewBox="0 0 24 24" {...sv} strokeWidth={2.2}><path d="m9 6 6 6-6 6" /></svg>,
  lock: <svg width="14" height="14" viewBox="0 0 24 24" {...sv} strokeWidth={2.2}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
};

/** A section folded into one line; its contents mount only once opened (so they don't load until wanted). */
export function Fold({ title, meta, icon, children, id }: { title: string; meta?: string; icon?: React.ReactNode; children: React.ReactNode; id?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="card fold" id={id} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        {icon && <span className="fold-icon" aria-hidden="true">{icon}</span>}
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="row-title">{title}</span>
          {meta && <span className="row-meta">{meta}</span>}
        </span>
      </summary>
      {open && <div className="fold-body">{children}</div>}
    </details>
  );
}

/** How pricey a round is: $ up to $70, $$ up to $120, $$$ above. Nothing when there's no price. */
export function Tier({ fee, inline = false }: { fee: number | null | undefined; inline?: boolean }) {
  const t = priceTier(fee);
  if (!t) return null;
  return <span className={`tier${inline ? ' inline' : ''}`} title={TIER_HINT[t]} aria-label={TIER_HINT[t]}><b>{t}</b>{'$$$'.slice(t.length)}</span>;
}
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
  /** Score taps waiting for signal (see lib/outbox). */
  outbox: OutboxItem[];
  vote: (optionId: string, value: VoteValue | null) => void;
  toast: (msg: string) => void;
  sheet: (s: SheetSpec | null) => void;
  go: (tab: TabId) => void;
  /** The destination the Stay and Golf tabs are showing (its option id), and a way to switch to another. */
  place: string | null;
  view: (place: string, tab?: TabId) => void;
}
export type TabId = 'trip' | 'vote' | 'stay' | 'golf' | 'cup' | 'flights';
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
  // Once it's locked, nobody is being waited on; show only the votes that were cast, if any.
  const waiting = option.locked ? [] : state.members.filter((m) => !vs[m.id]).map((m) => firstName(m.name));
  const voted: [string, string[]][] = ([['In', names('yes')], ['Maybe', names('maybe')], ['Out', names('no')]] as [string, string[]][]).filter(([, n]) => n.length);
  if (option.locked && !voted.length) return null;
  return (
    <div className="voters">
      <div>{voted.length ? voted.map(([k, n], i) => <span key={k}>{i ? ' · ' : ''}<b>{k}</b> {n.join(', ')}</span>) : <span>No votes yet</span>}</div>
      {waiting.length > 0 && <div className="voters-waiting"><b>Waiting on</b> {andList(waiting)}</div>}
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
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

/* ---------- who books it ---------- */
/** On a locked place or planned round: who's booking it and whether it's done. */
/** "🚗 9 min from We-Ko-Pa": one quiet line under a name. */
export function DriveLine({ text }: { text: string }) {
  return (
    <div className="drive-line">
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 17h14l-1.5-6.5A2 2 0 0 0 15.6 9H8.4a2 2 0 0 0-1.9 1.5Z" /><circle cx="8" cy="17" r="2" /><circle cx="16" cy="17" r="2" /></svg>
      <span>{text}</span>
    </div>
  );
}

/* ---------- the "•••" menu for a card's less-used actions ---------- */
export interface MenuItem { label: string; onClick: () => void; danger?: boolean }
export function MoreMenu({ items, label = 'More options' }: { items: (MenuItem | false | null | undefined)[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const list = items.filter(Boolean) as MenuItem[];
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('touchstart', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!list.length) return null;
  return (
    <div className="more" ref={ref}>
      <button type="button" className="btn small ghost more-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></svg>
      </button>
      {open && (
        <div className="more-menu" role="menu">
          {list.map((it) => <button key={it.label} type="button" role="menuitem" className={it.danger ? 'danger' : ''} onClick={() => { setOpen(false); it.onClick(); }}>{it.label}</button>)}
        </div>
      )}
    </div>
  );
}

/* ---------- booking: a status tag, the main button, and menu items ---------- */
type Bookable = Option<{ owner?: string; booked?: boolean; confirmation?: string }>;
/** "Booked · #1234" or "Not booked · Joe's booking", as a tag. Only for locked options. */
export function BookingTag({ option }: { option: Bookable }) {
  const { state, me } = useTrip();
  if (!option.locked || !me) return null;
  const owner = state.members.find((m) => m.id === option.data.owner);
  const who = owner ? (owner.id === me.id ? 'you’re booking' : `${firstName(owner.name)}’s booking`) : '';
  return option.data.booked
    ? <span className="good">Booked{option.data.confirmation ? ` · #${option.data.confirmation}` : owner ? ` by ${owner.id === me.id ? 'you' : firstName(owner.name)}` : ''}</span>
    : <span className="warn">Not booked{who ? ` · ${who}` : ''}</span>;
}
/** A confirmation number, tap to copy. */
export function ConfLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="conf-line" onClick={() => { navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}>
      <span className="row-meta">{label}</span><b>{value}</b><span className="row-meta">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}
/** The card's main button while it isn't booked: "Mark booked", for the organizer or whoever is booking it. */
export function BookButton({ option }: { option: Bookable }) {
  const ctx = useTrip();
  const { me } = ctx;
  if (!option.locked || !me || option.data.booked) return null;
  if (!me.is_organizer && option.data.owner !== me.id) return null;
  return <button className="btn small primary" onClick={() => bookedSheet(ctx, option as Option<Record<string, unknown>>)}>Mark booked</button>;
}
/** Booking items for the "•••" menu: assign who books it, or undo "booked". */
export function bookingItems(ctx: TripCtx, option: Bookable): (MenuItem | false)[] {
  const { me, act } = ctx;
  if (!option.locked || !me) return [];
  const canMark = me.is_organizer || option.data.owner === me.id;
  return [
    me.is_organizer && !option.data.booked && { label: option.data.owner ? 'Change who’s booking it' : 'Who’s booking it?', onClick: () => ownerSheet(ctx, option) },
    canMark && !!option.data.booked && { label: 'Mark not booked', onClick: () => act('set_booking', { optionId: option.id, booked: false }) },
  ];
}
function ownerSheet(ctx: TripCtx, option: Bookable) {
  ctx.sheet({ title: 'Who’s booking it?', body: (
    <div className="pick-list">
      {ctx.state.members.map((m) => (
        <button key={m.id} type="button" className={`pick${option.data.owner === m.id ? ' on' : ''}`} onClick={async () => { if (await ctx.act('set_booking', { optionId: option.id, owner: m.id })) { ctx.sheet(null); ctx.toast(`${m.id === ctx.me?.id ? 'You’re' : `${firstName(m.name)}’s`} booking it`); } }}>
          <span className="avatar-sm">{initials(m.name)}</span>{m.id === ctx.me?.id ? 'Me' : m.name}
        </button>
      ))}
      {option.data.owner && <button type="button" className="btn ghost block" onClick={async () => { if (await ctx.act('set_booking', { optionId: option.id, owner: '' })) ctx.sheet(null); }}>Nobody yet</button>}
    </div>
  ) });
}


/** "Mark booked": confirmed time, confirmation number, and what was paid for the group (into settle up). */
function BookedForm({ ctx, option }: { ctx: TripCtx; option: Option<Record<string, unknown>> }) {
  const round = option.kind === 'round';
  const n = ctx.state.members.length;
  const expected = round ? (Number(option.data.fee) || 0) * n : Number(option.data.total) || 0;
  const [time, setTime] = useState(String(option.data.time || ''));
  // What each player actually paid: replaces an estimate or "Price TBD", and teaches other groups the price.
  const known = round && Number(option.data.fee) > 0 && !option.data.estimate;
  const [fee, setFee] = useState(known ? String(option.data.fee) : '');
  const [conf, setConf] = useState('');
  const [prepaid, setPrepaid] = useState(!round);
  const [paid, setPaid] = useState(expected ? String(expected) : '');
  const [busy, setBusy] = useState(false);
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const ok = await ctx.act('set_booking', { optionId: option.id, booked: true, confirmation: conf, time: round ? time : undefined, ...(round && Number(fee) > 0 ? { fee: Number(fee) } : {}), paid: prepaid ? Number(paid) || 0 : 0 });
      setBusy(false);
      if (ok) { ctx.sheet(null); ctx.toast(prepaid && Number(paid) ? 'Booked, and added to settle up' : 'Marked booked. The group’s been told.'); }
    }}>
      {round && (
        <div className="field">
          <label htmlFor="bk-time">Tee time they confirmed</label>
          <input id="bk-time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="1:10 PM" />
        </div>
      )}
      {round && (
        <div className={`field${known ? '' : ' ask-price'}`}>
          <label htmlFor="bk-fee">What did each player pay? ($)</label>
          <input id="bk-fee" type="number" inputMode="decimal" min={0} step="any" value={fee} placeholder={option.data.fee ? `About ${option.data.fee}` : 'Greens fee per player'}
            onChange={(e) => { setFee(e.target.value); if (prepaid && Number(e.target.value)) setPaid(String(Number(e.target.value) * n)); }} />
          <p className="hint">{known ? 'Change it if the price was different.' : 'This round had no confirmed price. Adding it fixes the trip’s cost and helps other groups going there.'}</p>
        </div>
      )}
      <div className="field">
        <label htmlFor="bk-conf">Confirmation number <span style={{ fontWeight: 400 }}>(optional)</span></label>
        <input id="bk-conf" value={conf} onChange={(e) => setConf(e.target.value)} maxLength={40} autoComplete="off" />
      </div>
      <label className="check-row">
        <input type="checkbox" checked={prepaid} onChange={(e) => { setPrepaid(e.target.checked); if (e.target.checked && round && Number(fee)) setPaid(String(Number(fee) * n)); }} />
        <span>{round ? 'I paid for everyone up front' : 'I paid for the stay'}</span>
      </label>
      {prepaid && (
        <div className="field">
          <label htmlFor="bk-paid">Amount paid ($)</label>
          <input id="bk-paid" type="number" inputMode="decimal" min={0} step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} />
          <p className="hint">Goes into Settle up, split evenly with the whole group.</p>
        </div>
      )}
      <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Mark booked'}</button>
    </form>
  );
}

function bookedSheet(ctx: TripCtx, option: Option<Record<string, unknown>>) {
  ctx.sheet({ title: option.kind === 'round' ? `Booked ${String(option.data.course || 'the round')}` : `Booked ${String(option.data.name || 'the stay')}`, body: <BookedForm ctx={ctx} option={option} /> });
}
