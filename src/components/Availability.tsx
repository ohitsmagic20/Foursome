'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DateData } from '@/lib/shared';
import { andList, lockedOf, optionsOf, parseDay, rangeLabel, rankWeekends, weekendStart, weekendsAhead } from '@/lib/shared';
import { firstName } from '@/lib/client';
import { useTrip } from './ui';

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SAVE_MS = 700;

/** Everyone taps the weekends they can't make; the app ranks the weekends that work for the most people. */
export function Availability() {
  const ctx = useTrip();
  const { state, me, act, toast } = ctx;
  const fridays = useMemo(() => weekendsAhead(), []);
  const supported = state.members.some((m) => 'blackout' in m);
  const saved = me?.blackout;
  const [draft, setDraft] = useState<string[] | null>(saved ?? null);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);

  // Follow what's saved unless I'm in the middle of changing it.
  useEffect(() => { if (!dirty.current) setDraft(saved ?? null); }, [saved]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!supported || !me || lockedOf<DateData>(state, 'date')) return null;

  const answeredMe = draft !== null;
  const isOpen = open ?? !answeredMe;
  const nights = state.trip.nights;

  function save(next: string[]) {
    setDraft(next);
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await act('set_blackout', { dates: next });
      dirty.current = false;
    }, SAVE_MS);
  }
  const toggle = (f: string) => {
    setOpen(true); // keep it open while picking, even once this counts as answered
    const cur = draft || [];
    save(cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]);
  };

  // Rank with my unsaved changes included.
  const members = state.members.map((m) => (m.id === me.id ? { ...m, blackout: draft } : m));
  const { answered, ranked } = rankWeekends(members, fridays);
  const waiting = members.filter((m) => !Array.isArray(m.blackout));
  const existing = new Set(optionsOf<DateData>(state, 'date').map((d) => d.data.start));
  const best = answered.length >= 2 ? ranked.slice(0, 3) : [];

  const byMonth: [string, string[]][] = [];
  for (const f of fridays) {
    const d = parseDay(f);
    const label = `${MONTH[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`;
    const last = byMonth[byMonth.length - 1];
    if (last && last[0] === label) last[1].push(f); else byMonth.push([label, [f]]);
  }

  return (
    <div className="card avail">
      <div className="section-head">
        <div>
          <div className="row-title">Which weekends can’t you make?</div>
          <div className="row-meta">{answered.length} of {members.length} answered{waiting.length && waiting.length <= 4 ? ` · waiting on ${andList(waiting.map((m) => (m.id === me.id ? 'you' : firstName(m.name))))}` : ''}</div>
        </div>
        {answeredMe && !isOpen && <button type="button" className="link-btn" onClick={() => setOpen(true)}>Edit mine</button>}
      </div>

      {isOpen && (
        <>
          <p className="sub">Tap every weekend you’re out. Leave the rest.</p>
          {byMonth.map(([label, fs]) => (
            <div key={label} className="avail-month">
              <div className="avail-mlabel">{label}</div>
              <div className="avail-days">
                {fs.map((f) => {
                  const mine = !!draft?.includes(f);
                  const others = answered.filter((m) => m.id !== me.id && m.blackout!.includes(f)).length;
                  return (
                    <button key={f} type="button" className={`avail-day${mine ? ' out' : ''}`} aria-pressed={mine}
                      aria-label={`Weekend of ${rangeLabel(f, 2)}: ${mine ? 'you’re out' : 'you’re free'}${others ? `, ${others} others out` : ''}`}
                      onClick={() => toggle(f)}>
                      <span className="avail-num">{parseDay(f).getDate()}</span>
                      <span className="avail-sub">{mine ? 'Out' : others ? `${others} out` : ' '}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {!answeredMe
            ? <button type="button" className="btn block" onClick={() => { save([]); setOpen(false); toast('Saved: free every weekend'); }}>I can do any of these</button>
            : <button type="button" className="btn block" onClick={() => setOpen(false)}>Done</button>}
        </>
      )}

      {best.length > 0 && (
        <div className="avail-best">
          <div className="avail-mlabel">Best weekends so far</div>
          <div className="list">
            {best.map((w) => {
              const start = weekendStart(w.friday, nights);
              const added = existing.has(start);
              return (
                <div className="row" key={w.friday}>
                  <div className="grow">
                    <div className="row-title">{rangeLabel(start, nights)}</div>
                    <div className="row-meta">{w.out.length ? `Out: ${andList(w.out.map((m) => (m.id === me.id ? 'you' : firstName(m.name))))}` : `All ${answered.length} who answered are free`}</div>
                  </div>
                  {added
                    ? <span className="row-meta">In the vote</span>
                    : <button type="button" className="btn small" onClick={async () => { if (await act('add_option', { kind: 'date', data: { start, nights } })) toast('Added to the vote'); }}>Add to vote</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
