import type { Metadata } from 'next';
import { STATE_NAMES } from '@/data/packages';
import { ALL_PACKAGES, RESORTS, resortSearchUrl } from '@/lib/resorts';
import { PackageCard } from '@/components/PackageCard';

export const metadata: Metadata = {
  title: 'Golf stay & play packages and resorts · Foresome',
  description: `${ALL_PACKAGES.length}+ stay-and-play golf packages in every region, many with starting prices, plus ${RESORTS.length}+ US golf resorts by state, from Pinehurst and Kiawah to Kohler, Bandon Dunes, Pebble Beach and Myrtle Beach.`,
};

const byName = (a: string, b: string) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]);

export default function Packages() {
  const pkgStates = [...new Set(ALL_PACKAGES.map((p) => p.state))].sort(byName);
  const resortStates = [...new Set(RESORTS.map((r) => r.state))].sort(byName);
  const priced = ALL_PACKAGES.filter((p) => p.price).length;
  const places = new Set(ALL_PACKAGES.map((p) => `${p.resort}|${p.state}`)).size;
  const order = (a: (typeof ALL_PACKAGES)[number], b: (typeof ALL_PACKAGES)[number]) =>
    (a.price ? 0 : 1) - (b.price ? 0 : 1) || a.city.localeCompare(b.city) || a.resort.localeCompare(b.resort);
  return (
    <div className="app no-tabs">
      <header className="top">
        <div style={{ minWidth: 0 }}>
          <a className="eyebrow" href="/" style={{ textDecoration: 'none' }}>‹ Foresome</a>
          <h1>Stay & play</h1>
          <p className="sub" style={{ marginTop: 6 }}>{ALL_PACKAGES.length} golf packages at {places} resorts, hotels and courses in {pkgStates.length} states ({priced} with a posted price), plus {RESORTS.length} golf resorts across {resortStates.length} states.</p>
        </div>
      </header>

      <section className="section" id="packages">
        <h2>Packages, by state</h2>
        <p className="sub">Ones with a posted price come first. A “From” price is the lowest listed rate, usually per golfer sharing a room, before taxes; the listing says exactly what it covers.</p>
        <div className="resort-states">
          {pkgStates.map((s) => {
            const list = ALL_PACKAGES.filter((p) => p.state === s).sort(order);
            const n = list.filter((p) => p.price).length;
            return (
              <details key={s} className="card resort-state" id={`p-${s}`}>
                <summary><span>{STATE_NAMES[s]}</span><span className="row-meta">{list.length}{n ? ` · ${n} priced` : ''}</span></summary>
                <div className="list-cards">{list.map((p) => <PackageCard key={p.id} p={p} />)}</div>
              </details>
            );
          })}
        </div>
      </section>

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

      <p className="hint" style={{ marginTop: 20 }}>Checked November 2026. Packages come from each resort’s own site, GolfPass Travel, and the GolfTrips network’s state stay-and-play sites (arizonagolfer.com, golfmichigan.com, scgolf.com and the rest). The resort list comes from GolfPass’s state-by-state resort directories, Golf Digest’s best golf resorts and golftrips.com. Packages and prices change; always confirm with the resort.</p>
    </div>
  );
}
