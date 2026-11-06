import type { Metadata } from 'next';
import { PACKAGES, STATE_NAMES } from '@/data/packages';
import { RESORTS, resortSearchUrl } from '@/lib/resorts';
import { PackageCard } from '@/components/Packages';

export const metadata: Metadata = {
  title: 'Golf stay & play packages and resorts · Foresome',
  description: `Stay-and-play golf packages with starting prices, plus ${RESORTS.length}+ US golf resorts by state, from Pinehurst and Kiawah to Kohler, Bandon Dunes, Pebble Beach and Myrtle Beach.`,
};

const byName = (a: string, b: string) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]);

export default function Packages() {
  const pkgStates = [...new Set(PACKAGES.map((p) => p.state))].sort(byName);
  const resortStates = [...new Set(RESORTS.map((r) => r.state))].sort(byName);
  return (
    <div className="app no-tabs">
      <header className="top">
        <div style={{ minWidth: 0 }}>
          <a className="eyebrow" href="/" style={{ textDecoration: 'none' }}>‹ Foresome</a>
          <h1>Stay & play</h1>
          <p className="sub" style={{ marginTop: 6 }}>{PACKAGES.length} packages with published prices, and {RESORTS.length} golf resorts across {resortStates.length} states that sell golf with a stay.</p>
        </div>
      </header>

      <section className="section">
        <h2>Packages with prices</h2>
        <nav className="state-jump" aria-label="Jump to a state">
          {pkgStates.map((s) => <a key={s} href={`#p-${s}`} className="chip-btn">{STATE_NAMES[s]}</a>)}
        </nav>
      </section>
      {pkgStates.map((s) => (
        <section className="section" id={`p-${s}`} key={s}>
          <h3 className="state-h">{STATE_NAMES[s]}</h3>
          <div className="list-cards">{PACKAGES.filter((p) => p.state === s).map((p) => <PackageCard key={p.id} p={p} />)}</div>
        </section>
      ))}

      <section className="section" id="resorts">
        <h2>Every golf resort, by state</h2>
        <p className="sub">Most don’t post a set package price; they quote groups. Tap a resort to look up its current deals.</p>
        <div className="resort-states">
          {resortStates.map((s) => {
            const list = RESORTS.filter((r) => r.state === s).sort((a, b) => a.resort.localeCompare(b.resort));
            return (
              <details key={s} className="card resort-state">
                <summary><span>{STATE_NAMES[s]}</span><span className="row-meta">{list.length}</span></summary>
                <div className="list">
                  {list.map((r) => (
                    <a key={r.resort + r.city} className="row resort-row" href={resortSearchUrl(r)} target="_blank" rel="noopener noreferrer">
                      <div className="grow">
                        <div className="row-title">{r.resort}</div>
                        <div className="row-meta">{r.city}{r.courses.length ? ` · ${r.courses.join(', ')}` : ''}</div>
                      </div>
                      <span className="chev" aria-hidden="true">›</span>
                    </a>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <p className="hint" style={{ marginTop: 20 }}>Checked November 2026. Packages come from each resort’s own site and GolfPass Travel’s listings; the resort list comes from GolfPass’s state-by-state resort directories, Golf Digest’s best golf resorts and the golftrips.com package directory. Packages and prices change; always confirm with the resort.</p>
    </div>
  );
}
