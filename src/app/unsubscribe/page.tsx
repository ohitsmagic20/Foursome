'use client';

import { useState } from 'react';
import { api } from '@/lib/client';

export default function Unsubscribe() {
  const [state, setState] = useState<'ask' | 'busy' | 'done' | string>('ask');
  async function go() {
    setState('busy');
    const q = new URLSearchParams(location.search);
    try {
      await api('/api/unsubscribe', { body: { p: q.get('p'), k: q.get('k') } });
      setState('done');
    } catch (e) {
      setState(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }
  return (
    <div className="app no-tabs">
      <div className="hero">
        <div className="eyebrow">Foresome</div>
        <h1>{state === 'done' ? 'Trip emails are off' : 'Turn off trip emails?'}</h1>
        <p>{state === 'done'
          ? 'You won’t get reminders or plans by email. You’ll still get sign-in codes when you ask for one. Turn them back on any time in your profile.'
          : 'You’ll stop getting reminders to vote and trip plans by email. Sign-in codes still arrive when you ask for one.'}</p>
      </div>
      {state !== 'done' && (
        <div className="stack">
          {state !== 'ask' && state !== 'busy' && <p className="error" role="alert">{state}</p>}
          <button className="btn primary block" onClick={go} disabled={state === 'busy'}>{state === 'busy' ? <span className="spinner" /> : 'Turn off trip emails'}</button>
        </div>
      )}
      <p className="legal-links" style={{ marginTop: 20 }}><a href="/">Open Foresome</a></p>
    </div>
  );
}
