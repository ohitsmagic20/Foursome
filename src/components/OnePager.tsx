'use client';

import { useState } from 'react';
import { buildOnePager } from '@/lib/onepager';
import { useTrip } from './ui';

const fileName = (name: string) => `${name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'trip'}-one-pager.pdf`;

/**
 * Makes a one-page PDF of the trip as it stands (decided or not) and hands it to the phone's share sheet,
 * so it can go straight into the group chat. Falls back to a download.
 */
export function OnePagerButton() {
  const { state, toast } = useTrip();
  const [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true);
    try {
      const origin = window.location.origin;
      const url = `${origin}/t/${state.trip.code}`;
      // Heavy libraries load only now.
      const [{ pdf }, { OnePagerDoc, registerFonts }, QR] = await Promise.all([import('@react-pdf/renderer'), import('./OnePagerDoc'), import('qrcode')]);
      registerFonts(origin);
      const qr = await QR.toDataURL(url, { margin: 0, width: 240, color: { dark: '#1e5a3b', light: '#ffffff' } }).catch(() => '');
      const blob = await pdf(<OnePagerDoc d={buildOnePager(state)} url={url} qr={qr} />).toBlob();
      const file = new File([blob], fileName(state.trip.name), { type: 'application/pdf' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] }) && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)) {
        try { await nav.share({ files: [file], title: state.trip.name, text: `${state.trip.name}: where things stand. Vote and add ideas: ${url}` }); return; }
        catch (e) { if ((e as Error).name === 'AbortError') return; }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      toast('One-pager downloaded. Drop it in the group chat.');
    } catch (e) {
      console.error(e);
      toast('Couldn’t make the PDF. Try again in a moment.');
    } finally { setBusy(false); }
  };
  return (
    <button type="button" className={`onepager-card${busy ? ' busy' : ''}`} onClick={make} disabled={busy} aria-label="Make the trip one-pager PDF and share it">
      <MiniPage />
      <span className="onepager-text">
        <span className="onepager-eyebrow">PDF · one page</span>
        <span className="onepager-title">{busy ? 'Making your one-pager…' : 'Share the trip one-pager'}</span>
        <span className="onepager-sub">Where things stand and what’s left, ready for the group chat</span>
      </span>
      <span className="onepager-go" aria-hidden="true">
        {busy ? <span className="spinner" /> : (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m7 8 5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>
        )}
      </span>
    </button>
  );
}

/** A tiny drawing of the PDF itself: green header, stat tiles, lines of plan, a to-do box and the QR code. */
function MiniPage() {
  return (
    <span className="onepager-thumb" aria-hidden="true">
      <svg viewBox="0 0 48 62" width="48" height="62">
        <rect x="0.5" y="0.5" width="47" height="61" rx="3.5" fill="#fff" stroke="rgba(0,0,0,.08)" />
        <path d="M4 .5h40a3.5 3.5 0 0 1 3.5 3.5v10H.5V4A3.5 3.5 0 0 1 4 .5Z" fill="#1e5a3b" />
        <rect x="4" y="4" width="10" height="1.6" rx=".8" fill="#d9a62e" />
        <rect x="4" y="7.2" width="22" height="3" rx="1" fill="#fff" />
        <rect x="34" y="7.4" width="10" height="2.6" rx="1" fill="#d9a62e" />
        {[4, 15, 26, 37].map((x, i) => <rect key={x} x={x} y="17" width="9" height="6" rx="1.2" fill="#f2f4ee" stroke={i === 3 ? '#d9a62e' : '#2c7a4b'} strokeWidth=".6" />)}
        <rect x="4" y="25.5" width="40" height="3" rx="1" fill="#f7ecd0" />
        {[31.5, 35, 38.5, 42].map((y) => <rect key={y} x="4" y={y} width="24" height="1.6" rx=".8" fill="#dce2d8" />)}
        {[31.5, 35, 38.5, 42].map((y, i) => <rect key={`d${y}`} x="25" y={y} width="3" height="1.6" rx=".8" fill={i === 1 ? '#c9d0c6' : '#2c7a4b'} />)}
        <rect x="31" y="31" width="13" height="13" rx="1.5" fill="#f6ead6" />
        {[33.5, 37, 40.5].map((y) => <rect key={`t${y}`} x="33" y={y} width="9" height="1.4" rx=".7" fill="#a8691a" opacity=".55" />)}
        <rect x="4" y="47" width="40" height="5" rx="1" fill="none" stroke="#dce2d8" strokeWidth=".6" />
        <rect x="4" y="55" width="5" height="5" fill="#1e5a3b" />
        <rect x="5.3" y="56.3" width="2.4" height="2.4" fill="#fff" />
        <rect x="11" y="56" width="14" height="1.4" rx=".7" fill="#16241c" opacity=".5" />
        <rect x="11" y="58.4" width="10" height="1.2" rx=".6" fill="#1e5a3b" opacity=".6" />
      </svg>
    </span>
  );
}
