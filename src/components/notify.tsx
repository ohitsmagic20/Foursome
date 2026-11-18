'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { useTrip } from './ui';

// Notifications: on iPhone they work only once Foresome is on the Home Screen (iOS 16.4+).

type Status = 'loading' | 'unsupported' | 'needs-home-screen' | 'blocked' | 'off' | 'on';

function urlB64ToUint8Array(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function registerServiceWorker() {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

export function NotifyCard() {
  const { state, me, toast } = useTrip();
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState(false);
  const code = state.trip.code;
  const key = `foursome:push:${code}`;

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        setStatus(isIOS() && !standalone() ? 'needs-home-screen' : 'unsupported');
        return;
      }
      if (Notification.permission === 'denied') { setStatus('blocked'); return; }
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      let mine = false;
      try { mine = localStorage.getItem(key) === '1'; } catch { /* ignore */ }
      setStatus(sub && mine ? 'on' : 'off');
    })();
  }, [key]);

  async function turnOn() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus(perm === 'denied' ? 'blocked' : 'off'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const { key: pub } = await api<{ key: string }>('/api/push/key');
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(pub) }));
      await api(`/api/trips/${code}/push`, { code, body: { subscription: sub.toJSON() } });
      try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
      setStatus('on');
      toast('Notifications are on for this trip.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t turn on notifications.');
    } finally { setBusy(false); }
  }
  async function turnOff() {
    setBusy(true);
    try {
      await api(`/api/trips/${code}/push`, { code, method: 'DELETE' });
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      setStatus('off');
    } finally { setBusy(false); }
  }
  if (status === 'loading' || status === 'unsupported') return null;
  // One quiet line, not a card: it's a setting, not news.
  const bell = <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
  return (
    <div className={`notif-line ${status}`}>
      {bell}
      {status === 'on' ? (
        <><span className="grow">Notifications are on</span><button className="link-quiet" onClick={turnOff} disabled={busy}>Turn off</button></>
      ) : status === 'needs-home-screen' ? (
        <span className="grow">For notifications, add Foresome to your Home Screen (Share → Add to Home Screen)</span>
      ) : status === 'blocked' ? (
        <span className="grow">Notifications are blocked: Settings → Notifications → Foresome</span>
      ) : (
        <><span className="grow">Get a ping when plans change</span><button className="btn small primary" onClick={turnOn} disabled={busy}>{busy ? <span className="spinner" /> : 'Turn on'}</button></>
      )}
    </div>
  );

}

/** Organizer: push and email everyone who still has votes to cast (rate-limited on the server). */
export function useNudge() {
  const { state, toast } = useTrip();
  const code = state.trip.code;
  const [busy, setBusy] = useState(false);
  async function nudge() {
    setBusy(true);
    try {
      const r = await api<{ waiting: number; reachable: number; emailed?: number }>(`/api/trips/${code}/actions`, { code, body: { type: 'nudge' } });
      const how = [r.reachable ? `${r.reachable} by notification` : '', r.emailed ? `${r.emailed} by email` : ''].filter(Boolean).join(' and ');
      toast(how
        ? `Reminded ${how}. ${r.waiting} still need to vote.`
        : `None of them have notifications or trip emails on. Send the text instead.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Couldn’t send the reminder.');
    } finally { setBusy(false); }
  }
  return { nudge, busy };
}
