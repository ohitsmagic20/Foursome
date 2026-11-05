'use client';

import { useState } from 'react';
import { api } from '@/lib/client';

/** "Feedback" link that opens a short form in place. Goes to the app owner. */
export function FeedbackLink({ tripCode, askEmail = true }: { tripCode?: string; askEmail?: boolean }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'' | 'sending' | 'sent'>('');
  const [err, setErr] = useState('');

  if (state === 'sent') return <p className="hint feedback-done" role="status">Thanks, that goes straight to the person who builds Foresome.</p>;
  if (!open) return <button type="button" className="link-btn" onClick={() => setOpen(true)}>Feedback</button>;

  return (
    <form className="card form feedback-form" onSubmit={async (e) => {
      e.preventDefault();
      setErr('');
      setState('sending');
      try {
        await api('/api/feedback', { body: { message: msg, email, path: location.pathname + location.hash, tripCode } });
        setState('sent');
      } catch (x) {
        setErr(x instanceof Error ? x.message : 'That didn’t send. Try again.');
        setState('');
      }
    }}>
      <div className="field">
        <label htmlFor="fb-msg">What’s confusing, broken, or missing?</label>
        <textarea id="fb-msg" required rows={4} maxLength={2000} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="I couldn’t figure out how to…" autoFocus />
      </div>
      {askEmail && (
        <div className="field">
          <label htmlFor="fb-email">Your email <span style={{ fontWeight: 400 }}>(optional, for a reply)</span></label>
          <input id="fb-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
      )}
      {err && <p className="error" role="alert">{err}</p>}
      <div className="btn-row">
        <button className="btn primary small" disabled={state === 'sending' || msg.trim().length < 2}>{state === 'sending' ? <span className="spinner" /> : 'Send'}</button>
        <button type="button" className="btn small ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

/** Bottom of a screen: Feedback, Privacy, Terms. */
export function AppFooter({ tripCode, askEmail = true }: { tripCode?: string; askEmail?: boolean }) {
  return (
    <footer className="app-foot">
      <FeedbackLink tripCode={tripCode} askEmail={askEmail} />
      <p className="legal-links"><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
    </footer>
  );
}
