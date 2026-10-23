'use client';

import { useEffect, useState } from 'react';
import { ProfileForm, SignIn, signOut, useMe } from '@/components/account';
import { api, clearSession } from '@/lib/client';
import { Icon } from '@/components/ui';
import { initials } from '@/lib/client';
import type { Profile } from '@/lib/shared';

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
            <EmailSwitch on={me.profile.email_updates !== false} onChange={(profile) => setMe({ ...me, profile })} />
            <section className="section">
              <h2>Linked accounts</h2>
              <div className="list">
                {[
                  ['Airline loyalty numbers', 'Save your frequent flyer numbers for faster booking'],
                  ['GolfNow', 'Book tee times with your GolfNow account'],
                  ['Venmo or Cash App', 'Settle up shared costs like the house'],
                ].map(([t, d]) => (
                  <div className="row" key={t}>
                    <div className="grow"><div className="row-title">{t}</div><div className="row-meta">{d}</div></div>
                    <span className="chip plain">Coming soon</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="section">
              <h2>Privacy</h2>
              <div className="list">
                <a className="row" href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}><div className="grow row-title">Privacy policy</div>{Icon.chev}</a>
                <a className="row" href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}><div className="grow row-title">Terms of use</div>{Icon.chev}</a>
              </div>
            </section>
            <button className="btn ghost danger block" onClick={async () => { await signOut(); location.href = '/'; }}>Sign out</button>
            <DeleteAccount />

          </>
        )}
      </main>
    </div>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!open) return <button className="btn small ghost" style={{ alignSelf: 'center', color: 'var(--muted)' }} onClick={() => setOpen(true)}>Delete my account</button>;
  return (
    <section className="card form">
      <h2>Delete your account</h2>
      <p className="sub">Removes your profile and your spot on every trip. Can’t be undone.</p>
      <div className="field">
        <label htmlFor="del-confirm">Type DELETE to confirm</label>
        <input id="del-confirm" value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="characters" autoComplete="off" />
      </div>
      {err && <p className="error" role="alert">{err}</p>}
      <div className="btn-row">
        <button className="btn danger" disabled={busy || text.trim().toUpperCase() !== 'DELETE'} onClick={async () => {
          setBusy(true); setErr('');
          try {
            await api('/api/me/delete', { body: { confirm: text } });
            clearSession();
            try { Object.keys(localStorage).filter((k) => k.startsWith('foursome:')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
            location.href = '/';
          } catch (e) { setErr(e instanceof Error ? e.message : 'Couldn’t delete the account.'); setBusy(false); }
        }}>Delete my account</button>
        <button className="btn ghost" onClick={() => { setOpen(false); setText(''); }}>Cancel</button>
      </div>
    </section>
  );
}

function EmailSwitch({ on, onChange }: { on: boolean; onChange: (p: Profile) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <section className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div className="grow">
        <div className="row-title">Trip emails</div>
        <div className="row-meta">Vote reminders and the final plan.</div>
      </div>
      <button className="switch" role="switch" aria-checked={on} aria-label="Trip emails" disabled={busy} onClick={async () => {
        setBusy(true);
        try { const r = await api<{ profile: Profile }>('/api/me', { body: { email_updates: !on } }); onChange(r.profile); } catch { /* keep as is */ }
        setBusy(false);
      }} />
    </section>
  );
}
