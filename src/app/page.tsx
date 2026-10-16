'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, rememberTrip, savedTrips, setToken, type SavedTrip } from '@/lib/client';
import { Field, Icon, Select } from '@/components/ui';

export default function Home() {
  const router = useRouter();
  const [trips, setTrips] = useState<SavedTrip[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => setTrips(savedTrips()), []);

  return (
    <div className="app no-tabs">
      <div className="hero">
        <div className="eyebrow">Foursome</div>
        <h1>Plan the golf trip without the 200-message group text.</h1>
        <p>Everyone votes on the dates, the destination, where you stay and where you play. Then line up flights so you all land in time for the first tee.</p>
      </div>

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
            <div className="grid2">
              <Field name="nights" label="Nights" type="number" defaultValue={3} min={1} max={10} step={1} />
              <Field name="deposit" label="Deposit each ($)" type="number" placeholder="0" />
            </div>
            <Field name="name" label="Your name" placeholder="First and last" autoComplete="name" required />
            <div className="grid2">
              <Field name="airport" label="Home airport" placeholder="ORD" autoCapitalize="characters" maxLength={3} />
              <Field name="budget" label="Your budget ($)" type="number" placeholder="1500" />
            </div>
            <Select name="bed" label="Sleeping" defaultValue="own" options={[['own', 'I want my own bed'], ['share', 'I’m fine sharing a bed']]} />
            {err && <p className="error" role="alert">{err}</p>}
            <button className="btn primary block" disabled={busy}>{busy ? <span className="spinner" /> : 'Create trip and get the invite link'}</button>
          </form>
        </section>

        <section className="section">
          <h2>How it works</h2>
          <div className="steps">
            <div className="step"><b>1</b><div><div className="row-title">Send one link</div><div className="row-meta">Everyone joins from their phone with their airport, budget and whether they’ll share a bed.</div></div></div>
            <div className="step"><b>2</b><div><div className="row-title">The group votes</div><div className="row-meta">Dates, destination, rentals and tee times. You see who’s in and who hasn’t answered.</div></div></div>
            <div className="step"><b>3</b><div><div className="row-title">Lock it and book</div><div className="row-meta">The organizer locks the winners. Costs split automatically and flights line up with the first tee time.</div></div></div>
          </div>
        </section>
        <p className="hint">On iPhone, tap Share → Add to Home Screen to keep Foursome next to your other apps.</p>
      </div>
    </div>
  );
}
