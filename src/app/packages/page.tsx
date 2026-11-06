import type { Metadata } from 'next';
import { PACKAGES, STATE_NAMES } from '@/data/packages';
import { PackageCard } from '@/components/Packages';

export const metadata: Metadata = {
  title: 'Golf stay & play packages · Foresome',
  description: 'Stay-and-play golf packages at major US golf destinations, from Pinehurst and Kiawah to Kohler, Bandon Dunes, Pebble Beach and Myrtle Beach, with starting prices and where to book.',
};

export default function Packages() {
  const states = [...new Set(PACKAGES.map((p) => p.state))].sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]));
  return (
    <div className="app no-tabs">
      <header className="top">
        <div style={{ minWidth: 0 }}>
          <a className="eyebrow" href="/" style={{ textDecoration: 'none' }}>‹ Foresome</a>
          <h1>Stay & play packages</h1>
          <p className="sub" style={{ marginTop: 6 }}>Lodging and golf booked together at {PACKAGES.length} of the country’s big golf destinations. Prices are the published starting rate; follow the link for your dates.</p>
        </div>
      </header>
      <nav className="state-jump" aria-label="Jump to a state">
        {states.map((s) => <a key={s} href={`#${s}`} className="chip-btn">{STATE_NAMES[s]}</a>)}
      </nav>
      {states.map((s) => (
        <section className="section" id={s} key={s}>
          <h2>{STATE_NAMES[s]}</h2>
          <div className="list-cards">{PACKAGES.filter((p) => p.state === s).map((p) => <PackageCard key={p.id} p={p} />)}</div>
        </section>
      ))}
      <p className="hint" style={{ marginTop: 20 }}>Checked November 2026 from each resort’s own site and GolfPass Travel’s package listings. Packages and prices change; always confirm with the resort before booking.</p>
    </div>
  );
}
