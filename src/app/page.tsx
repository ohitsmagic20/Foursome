'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, initials, rememberTrip, savedTrips, setToken, type SavedTrip } from '@/lib/client';
import { rangeLabel } from '@/lib/shared';
import { Field, Icon } from '@/components/ui';
import { GuestFields, ProfileForm, SignIn, useMe } from '@/components/account';

export default function Home() {
  const router = useRouter();
  const { me, setMe, reload } = useMe();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const hero = (
    <div className="hero">
      <div className="eyebrow">Foursome</div>
      <h1>Plan the golf trip without the 200-message group text.</h1>
      <p>Everyone votes on the dates, the destination, where you stay and where you play. Then line up flights so you all land in time for the first tee.</p>
    </div>
  );

  if (me === undefined) return <div className="app no-tabs">{hero}</div>;

  if (me === null) return <SignedOut hero={hero} onSignedIn={reload} />;

  if (!me.complete) {
    return (
      <div className="app no-tabs">
        <div className="hero"><div className="eyebrow">Welcome</div><h1>Set up your profile</h1><p>Once, and every trip you join fills in from here.</p></div>
        <div className="card">
          <ProfileForm profile={me.profile} submitLabel="Save and continue" onSaved={(r) => setMe({ ...me, ...r })} />
        </div>
      </div>
    );
  }

  return (
    <div className="app no-tabs">
      <header className="top">
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">Foursome</div>
          <h1>Hey, {me.profile.name.split(' ')[0]}</h1>
        </div>
        <a className="avatar-btn" href="/profile" aria-label="Your profile">{initials(me.profile.name)}</a>
      </header>
      <div className="stack">
        <section className="section">
          <h2>Your trips</h2>
          {me.trips.length === 0
            ? <div className="card empty">No trips yet. Start one below, or open an invite link from a friend.</div>
            : (
              <div className="list">
                {me.trips.map((t) => (
                  <a key={t.code} className="row" href={`/t/${t.code}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                    <div className="grow">
                      <div className="row-title">{t.name}</div>
                      <div className="row-meta">
                        {[t.destination, t.start ? rangeLabel(t.start, t.nights) : 'Dates not set', `${t.members} going`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {t.organizer && <span className="chip plain">Organizer</span>}
                    {Icon.chev}
                  </a>
                ))}
              </div>
            )}
        </section>

        <section className="section">
          <h2>Start a trip</h2>
          <form className="form card" onSubmit={async (e) => {
            e.preventDefault();
            setErr('');
            setBusy(true);
            try {
              const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
              const r = await api<{ code: string; token: string }>('/api/trips', { body: fd });
              setToken(r.code, r.token);
              rememberTrip(r.code, fd.tripName);
              router.push(`/t/${r.code}`);
            } catch (x) {
              setErr(x instanceof Error ? x.message : 'Could not create the trip.');
              setBusy(false);
            }
          }}>
            <Field name="tripName" label="Trip name" placeholder="Spring Golf Trip 2027" required />
            <Field name="nights" label="Nights" type="number" defaultValue={3} min={1} max={10} step={1} />
            <p className="hint">You’ll be the organizer, flying from {me.profile.airport}. Next you’ll get an invite link for the group.</p>
            {err && <p className="error" role="alert">{err}</p>}
            <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Create trip'}</button>
          </form>
        </section>
        <HowItWorks />
        <p className="hint">On iPhone, tap Share → Add to Home Screen to keep Foursome next to your other apps.</p>
      </div>
    </div>
  );
}

/** No account: start a trip with just your name, see trips saved on this phone, or sign in. */
function SignedOut({ hero, onSignedIn }: { hero: React.ReactNode; onSignedIn: () => void }) {
  const router = useRouter();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [signIn, setSignIn] = useState(false);
  useEffect(() => setTrips(savedTrips()), []);
  return (
    <div className="app no-tabs">
      {hero}
      <div className="stack">
        {trips.length > 0 && (
          <section className="section">
            <h2>Your trips</h2>
            <div className="list">
              {trips.map((t) => (
                <a key={t.code} className="row" href={`/t/${t.code}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="grow row-title">{t.name}</div>{Icon.chev}
                </a>
              ))}
            </div>
          </section>
        )}
        {signIn ? (
          <>
            <SignIn onDone={() => onSignedIn()} note="Your trips follow you to any phone. No password: we’ll email you a sign-in link." />
            <button className="btn small ghost" onClick={() => setSignIn(false)}>Start a trip without an account</button>
          </>
        ) : (
          <section className="section">
            <h2>Start a trip</h2>
            <form className="form card" onSubmit={async (e) => {
              e.preventDefault();
              setErr('');
              setBusy(true);
              try {
                const fd = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
                const r = await api<{ code: string; token: string }>('/api/trips', { body: fd });
                setToken(r.code, r.token);
                rememberTrip(r.code, fd.tripName);
                router.push(`/t/${r.code}`);
              } catch (x) {
                setErr(x instanceof Error ? x.message : 'Could not create the trip.');
                setBusy(false);
              }
            }}>
              <div className="grid2">
                <Field name="tripName" label="Trip name" placeholder="Spring Golf Trip" required />
                <Field name="nights" label="Nights" type="number" defaultValue={3} min={1} max={10} step={1} />
              </div>
              <GuestFields />
              {err && <p className="error" role="alert">{err}</p>}
              <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Create trip and get the invite link'}</button>
              <button type="button" className="btn small ghost" onClick={() => setSignIn(true)}>Sign in to my Foursome account</button>
            </form>
          </section>
        )}
        <HowItWorks />
      </div>
    </div>
  );
}

function HowItWorks() {
  return (
    <section className="section">
      <h2>How it works</h2>
      <div className="steps">
        <div className="step"><b>1</b><div><div className="row-title">Send one link</div><div className="row-meta">Friends join with their name and home city. No app to download, no password.</div></div></div>
        <div className="step"><b>2</b><div><div className="row-title">The group votes</div><div className="row-meta">Dates, destination, rentals and tee times. You see who’s in and who hasn’t answered.</div></div></div>
        <div className="step"><b>3</b><div><div className="row-title">Lock it and book</div><div className="row-meta">The organizer locks the winners. Costs split automatically and flights line up with the first tee time.</div></div></div>
      </div>
    </section>
  );
}
