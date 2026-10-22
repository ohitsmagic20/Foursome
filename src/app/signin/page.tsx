'use client';

import { useEffect, useState } from 'react';
import { api, setSession } from '@/lib/client';

// Where the emailed sign-in link lands. Supabase puts the access token in the address after "#".
export default function SignInLanding() {
  const [msg, setMsg] = useState('Signing you in…');
  useEffect(() => {
    const p = new URLSearchParams(location.hash.slice(1));
    const nonce = new URLSearchParams(location.search).get('n') || undefined;
    const token = p.get('access_token');
    const err = p.get('error_description');
    history.replaceState(null, '', '/signin');
    if (!token) { setMsg(err ? `${err.replace(/\+/g, ' ')}. Go back and send a new code.` : 'This sign-in link is missing its code. Go back and send a new one.'); return; }
    api<{ session: string }>('/api/auth/link', { body: { access_token: token, nonce } })
      .then((r) => {
        setSession(r.session);
        if (nonce) setMsg('You’re signed in. If you started on the Foursome app, switch back to it; it has signed you in too.');
        else location.replace('/');
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : 'Sign-in failed.'));
  }, []);
  return (
    <div className="app no-tabs">
      <div className="hero"><div className="eyebrow">Foursome</div><h1>{msg}</h1><a className="btn primary" href="/">Continue here</a></div>
    </div>
  );
}
