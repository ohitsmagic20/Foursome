'use client';

import { useState } from 'react';
import { buildOnePager } from '@/lib/onepager';
import { Icon, useTrip } from './ui';

const fileName = (name: string) => `${name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'trip'}-one-pager.pdf`;

/**
 * Makes a one-page PDF of the trip as it stands (decided or not) and hands it to the phone's share sheet,
 * so it can go straight into the group chat. Falls back to a download.
 */
export function OnePagerButton({ block = false }: { block?: boolean }) {
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
    <button type="button" className={`btn${block ? ' block' : ''}`} onClick={make} disabled={busy}>
      {busy ? <span className="spinner" /> : Icon.doc} {busy ? 'Making the PDF…' : 'Trip one-pager (PDF)'}
    </button>
  );
}
