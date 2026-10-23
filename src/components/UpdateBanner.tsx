'use client';

import { useEffect, useState } from 'react';

// Shows a banner when a newer version of the app has been deployed, so nobody is stuck on an old copy.
const BUILD = process.env.NEXT_PUBLIC_BUILD || 'dev';

export default function UpdateBanner() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    if (BUILD === 'dev') return;
    const check = async () => {
      try {
        const r = await fetch('/api/version', { cache: 'no-store' });
        const { build } = await r.json();
        if (build && build !== BUILD) setStale(true);
      } catch { /* offline */ }
    };
    check();
    const t = setInterval(check, 5 * 60 * 1000);
    const vis = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, []);
  if (!stale) return null;
  return (
    <button className="update-banner" onClick={() => location.reload()}>
      A new version of Foursome is ready. <strong>Tap to update</strong>
    </button>
  );
}
