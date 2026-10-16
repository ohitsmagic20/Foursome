'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TripState, VoteValue, DestinationData, DateData } from '@/lib/shared';
import { pickOf, rangeLabel } from '@/lib/shared';
import { api, getToken, rememberTrip, setToken, firstName } from '@/lib/client';
import { Ctx, Icon, Sheet, type SheetSpec, type TabId, type TripCtx, Field, Select } from './ui';
import { TripTab } from './tabs/TripTab';
import { VoteTab } from './tabs/VoteTab';
import { StayTab } from './tabs/StayTab';
import { GolfTab } from './tabs/GolfTab';
import { FlightsTab } from './tabs/FlightsTab';
import { tripSheet } from './sheets';

const TABS: { id: TabId; label: string }[] = [
  { id: 'trip', label: 'Trip' },
  { id: 'vote', label: 'Vote' },
  { id: 'stay', label: 'Stay' },
  { id: 'golf', label: 'Golf' },
  { id: 'flights', label: 'Flights' },
];
const POLL_MS = 5000;

export default function TripApp({ code }: { code: string }) {
  const [state, setState] = useState<TripState | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('trip');
  const [sheetSpec, setSheet] = useState<SheetSpec | null>(null);
  const [toastMsg, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(0);

  const load = useCallback(async () => {
    try {
      const s = await api<TripState>(`/api/trips/${code}`, { code });
      if (pending.current === 0) setState(s); // don't overwrite a vote that's still saving
      setError('');
      if (s.meId) rememberTrip(code, s.trip.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the trip.');
    }
  }, [code]);

  // Keep everyone in sync: refresh every few seconds while the app is on screen.
  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    const vis = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [load]);

  useEffect(() => {
    const h = window.location.hash.slice(1) as TabId;
    if (TABS.some((t) => t.id === h)) setTab(h);
  }, []);

  const toast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2200);
  }, []);

  const act = useCallback(async (type: string, payload: Record<string, unknown> = {}) => {
    try {
      pending.current++;
      await api(`/api/trips/${code}/actions`, { code, body: { type, ...payload } });
      return true;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That did not save. Try again.');
      return false;
    } finally {
      pending.current--;
      load();
    }
  }, [code, load, toast]);

  const vote = useCallback((optionId: string, value: VoteValue | null) => {
    setState((s) => {
      if (!s || !s.meId) return s;
      const votes = s.votes.filter((v) => !(v.option_id === optionId && v.member_id === s.meId));
      if (value) votes.push({ option_id: optionId, member_id: s.meId, value });
      return { ...s, votes };
    });
    act('vote', { optionId, value });
  }, [act]);

  const go = useCallback((t: TabId) => {
    setTab(t);
    history.replaceState(null, '', `#${t}`);
    window.scrollTo({ top: 0 });
  }, []);

  const me = useMemo(() => state?.members.find((m) => m.id === state.meId) || null, [state]);
  const ctx: TripCtx | null = useMemo(() => state ? { state, me, act, vote, toast, sheet: setSheet, go } : null, [state, me, act, vote, toast, go]);

  if (error && !state) {
    return <div className="app no-tabs"><div className="hero"><h1>Trip not found</h1><p>{error}</p><a className="btn primary" href="/">Go to Foursome</a></div></div>;
  }
  if (!state || !ctx) {
    return <div className="app no-tabs"><div className="empty" style={{ paddingTop: 80 }}><span className="spinner" style={{ display: 'inline-block' }} /></div></div>;
  }
  if (!state.meId || !getToken(code)) {
    return <JoinScreen state={state} code={code} onJoined={load} />;
  }

  const date = pickOf<DateData>(state, 'date');
  const dest = pickOf<DestinationData>(state, 'destination');
  const eyebrow = [
    dest.option ? dest.option.data.name + (dest.locked ? '' : '?') : 'Destination TBD',
    date.option ? rangeLabel(date.option.data.start, state.trip.nights) + (date.locked ? '' : '?') : `${state.trip.nights} nights`,
  ].join(' · ');

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <header className="top">
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow">{eyebrow}</div>
            <h1>{state.trip.name}</h1>
          </div>
          {me?.is_organizer && <button className="icon-btn" aria-label="Edit trip" onClick={() => tripSheet(ctx)}>{Icon.edit}</button>}
        </header>
        <main className="stack">
          {tab === 'trip' && <TripTab />}
          {tab === 'vote' && <VoteTab />}
          {tab === 'stay' && <StayTab />}
          {tab === 'golf' && <GolfTab />}
          {tab === 'flights' && <FlightsTab />}
        </main>
      </div>
      <nav className="tabs" aria-label="Sections">
        <div className="in">
          {TABS.map((t) => (
            <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
              {Icon[t.id]}{t.label}
              {t.id !== 'trip' && t.id !== 'flights' && unvoted(state, t.id) > 0 && <span className="badge">{unvoted(state, t.id)}</span>}
            </button>
          ))}
        </div>
      </nav>
      <Sheet spec={sheetSpec} onClose={() => setSheet(null)} />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </Ctx.Provider>
  );
}

/** How many open options on a tab still need my vote. */
function unvoted(state: TripState, tab: TabId): number {
  const kinds = tab === 'vote' ? ['date', 'destination'] : tab === 'stay' ? ['lodging'] : tab === 'golf' ? ['round'] : [];
  const lockedKinds = new Set(state.options.filter((o) => o.locked && o.kind !== 'round').map((o) => o.kind));
  return state.options.filter((o) => kinds.includes(o.kind) && !lockedKinds.has(o.kind) && !o.locked &&
    !state.votes.some((v) => v.option_id === o.id && v.member_id === state.meId)).length;
}

function JoinScreen({ state, code, onJoined }: { state: TripState; code: string; onJoined: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const org = state.members.find((m) => m.is_organizer);
  return (
    <div className="app no-tabs">
      <div className="hero">
        <div className="eyebrow">You’re invited</div>
        <h1>{state.trip.name}</h1>
        <p>{org ? `${firstName(org.name)} is organizing` : 'A golf trip'} with {state.members.length} {state.members.length === 1 ? 'person' : 'people'} so far. Join to vote on dates, where to stay and where to play.</p>
      </div>
      <form className="form card" onSubmit={async (e) => {
        e.preventDefault();
        setErr('');
        setBusy(true);
        try {
          const fd = Object.fromEntries(new FormData(e.currentTarget));
          const r = await api<{ token: string }>(`/api/trips/${code}/join`, { body: fd });
          setToken(code, r.token);
          rememberTrip(code, state.trip.name);
          onJoined();
        } catch (x) {
          setErr(x instanceof Error ? x.message : 'Could not join.');
        } finally {
          setBusy(false);
        }
      }}>
        <Field name="name" label="Your name" required autoComplete="name" placeholder="First and last" />
        <div className="grid2">
          <Field name="airport" label="Home airport" placeholder="ORD" autoCapitalize="characters" maxLength={3} />
          <Field name="budget" label="Budget, all-in ($)" type="number" placeholder="1500" />
        </div>
        <Select name="bed" label="Sleeping" defaultValue="own" options={[['own', 'I want my own bed'], ['share', 'I’m fine sharing a bed']]} />
        <p className="hint">Your budget helps the group see what works for everyone. Only people on the trip can see it.</p>
        {err && <p className="error" role="alert">{err}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Join the trip'}</button>
      </form>
    </div>
  );
}
