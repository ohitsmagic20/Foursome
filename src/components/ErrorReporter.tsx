'use client';

import { useEffect } from 'react';

/** Sends unexpected errors on this phone to the server (at most 5 per visit), so the owner can fix them. */
export default function ErrorReporter() {
  useEffect(() => {
    let sent = 0;
    const seen = new Set<string>();
    const report = (message: string, detail = '') => {
      if (sent >= 5 || !message || seen.has(message)) return;
      // Browser extensions and harmless layout warnings aren't ours to fix.
      if (/ResizeObserver|extension:\/\/|Script error\.?$/i.test(`${message} ${detail}`)) return;
      seen.add(message); sent++;
      fetch('/api/errors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ message, path: location.pathname, detail: `${detail}\n${navigator.userAgent}`.slice(0, 2000) }) }).catch(() => {});
    };
    const onError = (e: ErrorEvent) => report(e.message, e.error?.stack || `${e.filename}:${e.lineno}`);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack || '' : '');
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);
  return null;
}
