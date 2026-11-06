'use client';

import { useEffect, useState } from 'react';
import type { StayPlay } from '@/data/packages';
import { PackageCard } from './PackageCard';

export { PackageCard };

type Near<T> = T & { miles: number };
interface NearbyResort { resort: string; city: string; state: string; courses: string[]; miles: number }

const search = (r: { resort: string; city: string; state: string }) =>
  `https://www.google.com/search?q=${encodeURIComponent(`${r.resort} ${r.city} ${r.state} stay and play golf package`)}`;

/** On the Stay tab: priced packages and every other golf resort near the trip's arrival airports. */
export function PackagesNear({ dest, airports }: { dest: string; airports: string[] }) {
  const [data, setData] = useState<{ packages: Near<StayPlay>[]; resorts: NearbyResort[] } | null>(null);
  const [allP, setAllP] = useState(false);
  const [allR, setAllR] = useState(false);
  const key = airports.join(',');
  useEffect(() => {
    if (!key) return;
    let live = true;
    fetch(`/api/nearby-resorts?airports=${encodeURIComponent(key)}`).then((r) => (r.ok ? r.json() : null)).then((j) => live && setData(j)).catch(() => {});
    return () => { live = false; };
  }, [key]);
  if (!data || (!data.packages.length && !data.resorts.length)) return null;
  const pk = allP ? data.packages : data.packages.slice(0, 3);
  const rs = allR ? data.resorts : data.resorts.slice(0, 6);
  const place = dest.split(',')[0];
  const priced = data.packages.filter((p) => p.price).length;
  return (
    <section className="section">
      <div className="section-head"><h2>Stay & play</h2><a className="link-btn" href="/packages" target="_blank" rel="noopener noreferrer">All resorts</a></div>
      <p className="sub">Lodging and golf in one booking near {place}{data.packages.length ? `: ${data.packages.length} package${data.packages.length === 1 ? '' : 's'}${priced ? `, ${priced} with a posted price` : ''}` : ''}. Compare it with renting a house and booking tee times yourself.</p>
      {pk.length > 0 && <div className="list-cards">{pk.map((p) => <PackageCard key={p.id} p={p} miles={p.miles} />)}</div>}
      {data.packages.length > 3 && <button className="btn block" onClick={() => setAllP(!allP)}>{allP ? 'Fewer packages' : `All ${data.packages.length} packages`}</button>}
      {data.resorts.length > 0 && (
        <div className="card">
          <div className="row-title">{data.packages.length ? 'More golf resorts nearby' : `Golf resorts near ${place}`}</div>
          <div className="row-meta">These have golf and lodging but no package listed. Ask them for a group quote.</div>
          <div className="list resort-list">
            {rs.map((r) => (
              <div className="row" key={r.resort + r.city}>
                <div className="grow">
                  <div className="row-title">{r.resort}</div>
                  <div className="row-meta">{r.city}, {r.state} · {r.miles} mi{r.courses.length ? ` · ${r.courses.slice(0, 4).join(', ')}${r.courses.length > 4 ? '…' : ''}` : ''}</div>
                </div>
                <a className="btn small" href={search(r)} target="_blank" rel="noopener noreferrer">Find deals</a>
              </div>
            ))}
          </div>
          {data.resorts.length > 6 && <button className="btn block" onClick={() => setAllR(!allR)}>{allR ? 'Show fewer' : `Show all ${data.resorts.length}`}</button>}
        </div>
      )}
      <p className="hint">“From” prices are the lowest listed rate, usually per golfer sharing a room, before taxes; the listing says exactly what it covers. Distances are from the {airports[0]} airport.</p>
    </section>
  );
}
