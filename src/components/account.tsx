'use client';

import { useEffect, useRef, useState } from 'react';
import type { MyTrip, NearbyAirport, Profile } from '@/lib/shared';
import { api, clearSession, getSession, setSession } from '@/lib/client';

export interface MeState { profile: Profile; complete: boolean; trips: MyTrip[] }

/** Load the signed-in person. `null` = signed out, `undefined` = still loading. */
export function useMe() {
  const [me, setMe] = useState<MeState | null | undefined>(undefined);
  const reload = async () => {
    if (!getSession()) { setMe(null); return; }
    try {
      setMe(await api<MeState>('/api/me'));
    } catch (e) {
      // A dead session (signed out elsewhere) shows as signed out.
      if (e instanceof Error && /sign in/i.test(e.message)) clearSession();
      setMe(null);
    }
  };
  useEffect(() => { reload(); }, []);
  return { me, setMe, reload };
}

/* ---------- sign in: email → 6-digit code ---------- */
export function SignIn({ onDone, title = 'Sign in or create an account', note }: {
  onDone: (r: { profile: Profile; complete: boolean }) => void; title?: string; note?: string;
}) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [resent, setResent] = useState(false);
  const [nonce, setNonce] = useState('');
  const [showCode, setShowCode] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  // While waiting, check every few seconds whether the emailed link was opened (in Mail, Safari, anywhere).
  useEffect(() => {
    if (step !== 'code' || !nonce) return;
    let live = true;
    const tick = async () => {
      try {
        const r = await api<{ done: boolean; session?: string; profile?: Profile; complete?: boolean }>(`/api/auth/poll?n=${encodeURIComponent(nonce)}`);
        if (live && r.done && r.session && r.profile) { setSession(r.session); onDone({ profile: r.profile, complete: !!r.complete }); }
      } catch { /* keep waiting */ }
    };
    const t = setInterval(tick, 2500);
    const vis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', vis);
    return () => { live = false; clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [step, nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    setErr(''); setBusy(true);
    try {
      const r = await api<{ nonce?: string }>('/api/auth/start', { body: { email } });
      setNonce(r.nonce || '');
      setStep('code');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Couldn’t send the email.'); }
    finally { setBusy(false); }
  }
  async function verify(c = code) {
    setErr(''); setBusy(true);
    try {
      const r = await api<{ session: string; profile: Profile; complete: boolean }>('/api/auth/verify', { body: { email, code: c } });
      setSession(r.session);
      onDone(r);
    } catch (e) { setErr(e instanceof Error ? e.message : 'That code didn’t work.'); setBusy(false); }
  }

  return (
    <div className="card form">
      <div>
        <h2>{step === 'email' ? title : 'Check your email'}</h2>
        <p className="sub" style={{ marginTop: 4 }}>
          {step === 'email' ? (note || 'No password. We’ll email you a sign-in link.') : <>We sent a sign-in link to <strong>{email}</strong>. Tap it, then come back here. This screen signs you in by itself.</>}
        </p>
      </div>
      {step === 'email' ? (
        <form className="form" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <div className="field">
            <label htmlFor="f-email">Email</label>
            <input id="f-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          {err && <p className="error" role="alert">{err}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Email me a sign-in link'}</button>
        </form>
      ) : (
        <form className="form" onSubmit={(e) => { e.preventDefault(); verify(); }}>
          <div className="waiting"><span className="spinner" /> Waiting for you to tap the link…</div>
          {!showCode && <button type="button" className="btn small ghost" onClick={() => { setShowCode(true); setTimeout(() => codeRef.current?.focus(), 50); }}>Got a 6-digit code instead?</button>}
          {showCode && <div className="field">
            <label htmlFor="f-code">Code</label>
            <input id="f-code" ref={codeRef} className="code-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8}
              value={code} onChange={(e) => { const v = e.target.value.replace(/\D/g, ''); setCode(v); if (v.length === 6) verify(v); }} placeholder="••••••" />
          </div>}
          {err && <p className="error" role="alert">{err}</p>}
          {showCode && <button className="btn primary block" disabled={busy || code.length < 6}>{busy ? <span className="spinner" /> : 'Sign in'}</button>}
          <div className="btn-row" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn small ghost" onClick={() => { setStep('email'); setCode(''); setErr(''); }}>Use a different email</button>
            <button type="button" className="btn small ghost" disabled={busy || resent} onClick={async () => { await send(); setResent(true); }}>{resent ? 'Sent again' : 'Send it again'}</button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ---------- profile ---------- */
export function ProfileForm({ profile, onSaved, submitLabel = 'Save', intro }: {
  profile: Profile; onSaved: (r: { profile: Profile; complete: boolean }) => void; submitLabel?: string; intro?: React.ReactNode;
}) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [city, setCity] = useState(profile.home_city);
  const [airport, setAirport] = useState(profile.airport);
  const [budget, setBudget] = useState(profile.budget ? String(profile.budget) : '');
  const [bed, setBed] = useState(profile.bed);
  const [found, setFound] = useState<NearbyAirport[]>([]);
  const [looking, setLooking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const lastCity = useRef('');

  useEffect(() => {
    const q = city.trim();
    if (q.length < 2 || q === lastCity.current) return;
    const t = setTimeout(async () => {
      lastCity.current = q;
      setLooking(true);
      try {
        const r = await api<{ airports: NearbyAirport[] }>(`/api/airports?place=${encodeURIComponent(q)}`);
        setFound(r.airports.slice(0, 4));
        if (!airport || !r.airports.some((a) => a.code === airport)) {
          const best = r.airports.find((a) => a.suggested) || r.airports[0];
          if (best) setAirport(best.code);
        }
      } catch { setFound([]); } finally { setLooking(false); }
    }, 600);
    return () => clearTimeout(t);
  }, [city]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = found.length ? found : airport ? [{ code: airport, name: 'Your home airport', city: '', miles: -1, major: false, suggested: true }] : [];

  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      setErr('');
      if (!name.trim()) { setErr('Enter your name.'); return; }
      if (airport.length !== 3) { setErr('Pick your home airport so flight search knows where you’re coming from.'); return; }
      setBusy(true);
      try {
        onSaved(await api<{ profile: Profile; complete: boolean }>('/api/me', { body: { name, phone, home_city: city, airport, budget: Number(budget) || 0, bed } }));
      } catch (x) { setErr(x instanceof Error ? x.message : 'Couldn’t save.'); }
      finally { setBusy(false); }
    }}>
      {intro}
      <div className="field">
        <label htmlFor="p-name">Name</label>
        <input id="p-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="First and last" required />
      </div>
      <div className="field">
        <label htmlFor="p-email">Email</label>
        <input id="p-email" value={profile.email} readOnly disabled />
      </div>
      <div className="field">
        <label htmlFor="p-phone">Phone <span style={{ fontWeight: 500 }}>(optional)</span></label>
        <input id="p-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(312) 555-0142" />
      </div>
      <div className="field">
        <label htmlFor="p-city">Home city</label>
        <input id="p-city" value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" placeholder="Chicago, IL" />
      </div>
      {looking && <p className="hint">Finding airports near {city.trim()}…</p>}
      {shown.length > 0 && (
        <div className="field">
          <label>Home airport</label>
          <div className="airport-list">
            {shown.map((a) => (
              <button type="button" key={a.code} className="airport" aria-pressed={airport === a.code} onClick={() => setAirport(a.code)}>
                <span className="code">{a.code}</span>
                <span className="grow" style={{ textAlign: 'left' }}>
                  <span className="row-title" style={{ display: 'block' }}>{a.name}</span>
                  {a.miles >= 0 && <span className="row-meta">{a.miles} mi from {city.split(',')[0]}</span>}
                </span>
                <span className="check" aria-hidden="true">{airport === a.code ? '✓' : ''}</span>
              </button>
            ))}
          </div>
          <p className="hint">Flight searches start here. You can change it per trip by editing your profile.</p>
        </div>
      )}
      <div className="grid2">
        <div className="field">
          <label htmlFor="p-budget">Usual trip budget ($)</label>
          <input id="p-budget" type="number" inputMode="decimal" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="1500" />
        </div>
        <div className="field">
          <label htmlFor="p-bed">Sleeping</label>
          <select id="p-bed" value={bed} onChange={(e) => setBed(e.target.value as Profile['bed'])}>
            <option value="own">Own bed</option>
            <option value="share">Fine sharing</option>
          </select>
        </div>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : submitLabel}</button>
    </form>
  );
}

export async function signOut() {
  try { await api('/api/auth/signout', { body: {} }); } catch { /* already gone */ }
  clearSession();
}
