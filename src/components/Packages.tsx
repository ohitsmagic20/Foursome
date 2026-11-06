'use client';

import { useEffect, useState } from 'react';
import type { StayPlay } from '@/data/packages';
import { priceLabel } from '@/data/packages';

/** One stay-and-play package: where, which courses, the shape of the deal, and a link to book. */
export function PackageCard({ p, miles }: { p: StayPlay; miles?: number }) {
  return (
    <div className="card pkg">
      <div className="pkg-head">
        <div style={{ minWidth: 0 }}>
          <div className="row-title">{p.resort}</div>
          <div className="row-meta">{p.name} · {p.city}, {p.state}{miles !== undefined ? ` · ${miles} mi` : ''}</div>
        </div>
        <div className={`pkg-price${p.price ? '' : ' quote'}`}>{priceLabel(p)}</div>
      </div>
      <div className="pkg-courses">{p.courses.join(' · ')}</div>
      {(p.shape || p.includes) && <div className="row-meta">{[p.shape, p.includes].filter(Boolean).join('. ').replace(/\.\./g, '.')}</div>}
      {p.price?.note && <div className="row-meta">{p.price.note}</div>}
      <div className="pkg-foot">
        <span className="row-meta">Checked {p.checked} · {p.source}</span>
        <a className="btn small" href={p.url} target="_blank" rel="noopener noreferrer">See rates</a>
      </div>
    </div>
  );
}

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
  return (
    <section className="section">
      <div className="section-head"><h2>Stay & play</h2><a className="link-btn" href="/packages" target="_blank" rel="noopener noreferrer">All resorts</a></div>
      <p className="sub">Lodging and golf in one booking near {place}. Compare it with renting a house and booking tee times yourself.</p>
      {pk.length > 0 && <div className="list-cards">{pk.map((p) => <PackageCard key={p.id} p={p} miles={p.miles} />)}</div>}
      {data.packages.length > 3 && <button className="btn block" onClick={() => setAllP(!allP)}>{allP ? 'Fewer packages' : `All ${data.packages.length} packages`}</button>}
      {data.resorts.length > 0 && (
        <div className="card">
          <div className="row-title">{data.packages.length ? 'More golf resorts nearby' : `Golf resorts near ${place}`}</div>
          <div className="row-meta">These sell golf with a stay too, but don’t post a set price. Ask them for a group quote.</div>
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
      <p className="hint">“From” prices are the lowest published rate, usually sharing a room, before taxes. Distances are from the {airports[0]} airport.</p>
    </section>
  );
}
