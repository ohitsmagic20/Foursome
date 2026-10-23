'use client';

import { useEffect, useState } from 'react';

/** Receives the trips and sign-in saved on the old address (see OldDomain) and stores them here. */
export default function Migrate() {
  const [msg, setMsg] = useState('Moving your trips to foresomes.net…');
  useEffect(() => {
    let back = '/';
    try {
      const raw = location.hash.slice(1);
      if (raw) {
        const { saved, back: b } = JSON.parse(decodeURIComponent(escape(atob(raw)))) as { saved?: Record<string, string>; back?: string };
        if (typeof b === 'string' && b.startsWith('/') && !b.startsWith('//')) back = b;
        for (const [k, v] of Object.entries(saved || {})) {
          if (!k.startsWith('foursome:') || typeof v !== 'string') continue;
          // Don't overwrite a sign-in or trip spot this phone already has here.
          if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
          else if (k === 'foursome:trips') {
            // Merge the saved-trips lists.
            try {
              const mine = JSON.parse(localStorage.getItem(k) || '[]') as { code: string }[];
              const theirs = JSON.parse(v) as { code: string }[];
              const codes = new Set(mine.map((t) => t.code));
              localStorage.setItem(k, JSON.stringify([...mine, ...theirs.filter((t) => !codes.has(t.code))]));
            } catch { /* keep what's here */ }
          }
        }
      }
    } catch {
      setMsg('Couldn’t bring your trips over automatically. Open your invite links again to get back in.');
    }
    history.replaceState(null, '', '/migrate');
    location.replace(back);
  }, []);
  return <div className="app no-tabs"><div className="hero"><div className="eyebrow">Foresome</div><p>{msg}</p></div></div>;
}
