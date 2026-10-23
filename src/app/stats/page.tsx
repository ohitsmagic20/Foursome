'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { SignIn, useMe } from '@/components/account';

interface Stats {
  trips: number; trips7: number; trips30: number; planned: number; members: number; guests: number; accounts: number;
  expenses: number; shared: number; errors7: number; groupSize: number;
  weeks: { start: string; trips: number }[]; ideas: { slug: string; trips: number }[];
  errors: { at: string; source: string; message: string; path: string }[];
}

/** For the app owner only: is anyone using it, and is anything breaking? */
export default function StatsPage() {
  const { me } = useMe();
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { if (me) api<Stats>('/api/stats').then(setS).catch((e) => setErr(e instanceof Error ? e.message : 'Couldn’t load.')); }, [me]);
  const max = Math.max(1, ...(s?.weeks || []).map((w) => w.trips));
  const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="app no-tabs">
      <header className="top"><div><a className="eyebrow" href="/profile" style={{ textDecoration: 'none' }}>‹ Profile</a><h1>App stats</h1></div></header>
      {me === null && <SignIn onDone={() => location.reload()} />}
      {err && <p className="error">{err}</p>}
      {s && (
        <main className="stack">
          <div className="summary">
            <div className="stat"><span className="k">Trips</span><span className="v">{s.trips}</span><span className="n">{s.trips7} this week</span></div>
            <div className="stat"><span className="k">People</span><span className="v">{s.members}</span><span className="n">{s.groupSize} per trip</span></div>
            <div className="stat"><span className="k">Planned</span><span className="v">{s.planned}</span><span className="n">dates + place locked</span></div>
          </div>
          <section className="section">
            <h2>New trips by week</h2>
            <div className="card stats-weeks">
              {s.weeks.map((w) => (
                <div key={w.start} className="stats-week" title={`${w.trips} trips, week of ${w.start}`}>
                  <span className="stats-bar" style={{ height: `${(w.trips / max) * 100}%` }} />
                  <span className="row-meta">{w.trips}</span>
                </div>
              ))}
            </div>
            <p className="hint">Last 8 weeks · {s.trips30} trips in the last 30 days</p>
          </section>
          <section className="section">
            <h2>People</h2>
            <div className="list">
              <div className="row"><div className="grow">Accounts</div><b>{s.accounts}</b></div>
              <div className="row"><div className="grow">Guests (no account)</div><b>{s.guests}</b></div>
              <div className="row"><div className="grow">Expenses logged</div><b>{s.expenses}</b></div>
              <div className="row"><div className="grow">Trips shared as ideas</div><b>{s.shared}</b></div>
            </div>
          </section>
          <section className="section">
            <h2>Trip ideas used</h2>
            {s.ideas.length ? (
              <div className="list">{s.ideas.map((i) => <div className="row" key={i.slug}><div className="grow">{i.slug}</div><b>{i.trips}</b></div>)}</div>
            ) : <p className="sub">No trips started from an idea yet.</p>}
          </section>
          <section className="section">
            <div className="section-head"><h2>Errors</h2><span className="sub">{s.errors7} this week</span></div>
            {s.errors.length ? (
              <div className="list">
                {s.errors.map((e, i) => (
                  <div className="row" key={i} style={{ alignItems: 'flex-start' }}>
                    <div className="grow"><div className="row-title" style={{ fontWeight: 500, fontSize: 14 }}>{e.message}</div><div className="row-meta">{when(e.at)} · {e.source}{e.path ? ` · ${e.path}` : ''}</div></div>
                  </div>
                ))}
              </div>
            ) : <p className="sub">No errors recorded.</p>}
          </section>
        </main>
      )}
    </div>
  );
}
