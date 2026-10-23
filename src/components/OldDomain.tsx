'use client';

import { useEffect } from 'react';

const OLD_HOSTS = ['foresome-one.vercel.app'];
const NEW_ORIGIN = 'https://www.foresomes.net';

/** On the old address, carry this phone's trips and sign-in over to foresomes.net, then go there.
 *  localStorage belongs to one address, so the saved trip keys travel in the URL fragment
 *  (never sent to any server) and the /migrate page saves them on the new address. */
export default function OldDomain() {
  useEffect(() => {
    if (!OLD_HOSTS.includes(location.hostname)) return;
    const saved: Record<string, string> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('foursome:')) saved[k] = localStorage.getItem(k) || '';
      }
    } catch { /* storage blocked: just move */ }
    const back = location.pathname + location.search;
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ saved, back }))));
    location.replace(`${NEW_ORIGIN}/migrate#${payload}`);
  }, []);
  return null;
}
