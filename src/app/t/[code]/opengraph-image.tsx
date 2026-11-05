import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { tripByCode } from '@/lib/server';
import { tripPreview } from '@/lib/preview';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Golf trip invite';

const GREEN = '#1e5a3b', GOLD = '#d9a62e', INK = '#14201a', CREAM = '#f2f4ee', MUTED = '#5c6b62';

// The picture that shows when a trip link is texted or posted: trip name, where, when, who's in.
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [display, body] = await Promise.all([
    readFile(join(process.cwd(), 'assets/barlow-condensed-latin-700-normal.woff')),
    readFile(join(process.cwd(), 'assets/instrument-sans-latin-500-normal.woff')),
  ]);
  let name = 'A golf trip', lines: string[] = [], who = '';
  try {
    const trip = await tripByCode(code);
    const p = await tripPreview(trip);
    name = trip.name;
    lines = [
      p.place || (p.placeOptions ? `${p.placeOptions} place${p.placeOptions > 1 ? 's' : ''} in the running` : 'Where: up for a vote'),
      p.dates || (p.dateOptions ? `${p.dateOptions} date option${p.dateOptions > 1 ? 's' : ''}` : 'When: up for a vote'),
    ];
    who = p.count > 1 ? `${p.names.slice(0, 4).join(', ')}${p.count > 4 ? ` +${p.count - 4}` : ''} ${p.count === 1 ? 'is' : 'are'} in` : p.organizer ? `${p.organizer} is organizing` : '';
  } catch { /* unknown code: show the generic card */ }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: CREAM, padding: 64, fontFamily: 'Body' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none"><path d="M7 21V3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" /><path d="M7 3.6h10.5l-2.8 3.7 2.8 3.7H7z" fill={GOLD} /></svg>
          </div>
          <div style={{ fontFamily: 'Display', fontSize: 34, color: GREEN, letterSpacing: 1 }}>FORESOME</div>
          <div style={{ marginLeft: 'auto', fontSize: 26, color: MUTED }}>You’re invited</div>
        </div>
        <div style={{ fontFamily: 'Display', fontSize: name.length > 26 ? 84 : 108, color: INK, lineHeight: 1, marginTop: 56, display: 'flex' }}>{name}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}>
          {lines.map((l) => <div key={l} style={{ fontSize: 40, color: INK, display: 'flex' }}>{l}</div>)}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 30, color: MUTED, display: 'flex' }}>{who}</div>
          <div style={{ background: GREEN, color: '#fff', fontSize: 30, padding: '14px 28px', borderRadius: 999, display: 'flex' }}>Tap to join and vote</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Display', data: display, weight: 700 }, { name: 'Body', data: body, weight: 500 }] },
  );
}
