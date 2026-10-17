'use client';

import { useEffect, useState } from 'react';
import { ProfileForm, SignIn, signOut, useMe } from '@/components/account';
import { initials } from '@/lib/client';

export default function ProfilePage() {
  const { me, setMe } = useMe();
  const [back, setBack] = useState('/');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const b = new URLSearchParams(location.search).get('back');
    if (b && b.startsWith('/')) setBack(b);
  }, []);

  return (
    <div className="app no-tabs">
      <header className="top">
        <div style={{ minWidth: 0 }}>
          <a className="eyebrow" href={back} style={{ textDecoration: 'none' }}>‹ Back</a>
          <h1>Your profile</h1>
        </div>
        {me && <div className="avatar big">{initials(me.profile.name || me.profile.email)}</div>}
      </header>
      <main className="stack">
        {me === undefined && <div className="empty"><span className="spinner" style={{ display: 'inline-block' }} /></div>}
        {me === null && <SignIn onDone={() => location.reload()} />}
        {me && (
          <>
            {saved && <div className="callout good">Saved. Your trips use these details now.</div>}
            <div className="card">
              <ProfileForm profile={me.profile} onSaved={(r) => { setMe({ ...me, ...r }); setSaved(true); window.scrollTo({ top: 0 }); }} />
            </div>
            <section className="section">
              <h2>Linked accounts</h2>
              <div className="list">
                {[
                  ['Airline loyalty numbers', 'Save your frequent flyer numbers for faster booking'],
                  ['GolfNow', 'Book tee times with your GolfNow account'],
                  ['Venmo or Cash App', 'Settle deposits and split costs'],
                ].map(([t, d]) => (
                  <div className="row" key={t}>
                    <div className="grow"><div className="row-title">{t}</div><div className="row-meta">{d}</div></div>
                    <span className="chip plain">Coming soon</span>
                  </div>
                ))}
              </div>
            </section>
            <button className="btn ghost danger block" onClick={async () => { await signOut(); location.href = '/'; }}>Sign out</button>
          </>
        )}
      </main>
    </div>
  );
}
