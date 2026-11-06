'use client';

import { useState } from 'react';
import type { StayPlay } from '@/data/packages';
import { packagesFor, priceLabel } from '@/data/packages';

/** One stay-and-play package: where, which courses, the shape of the deal, and a link to book. */
export function PackageCard({ p }: { p: StayPlay }) {
  return (
    <div className="card pkg">
      <div className="pkg-head">
        <div style={{ minWidth: 0 }}>
          <div className="row-title">{p.resort}</div>
          <div className="row-meta">{p.name} · {p.city}, {p.state}</div>
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

/** On the Stay tab: packages near the trip's destination. */
export function PackagesNear({ dest, airports }: { dest: string; airports: string[] }) {
  const list = packagesFor({ name: dest, airports });
  const [all, setAll] = useState(false);
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, 3);
  return (
    <section className="section">
      <div className="section-head"><h2>Stay & play packages</h2><a className="link-btn" href="/packages" target="_blank" rel="noopener noreferrer">All packages</a></div>
      <p className="sub">Lodging and golf in one booking near {dest.split(',')[0]}. Compare it with renting a house and booking tee times yourself.</p>
      <div className="list-cards">{shown.map((p) => <PackageCard key={p.id} p={p} />)}</div>
      {list.length > 3 && <button className="btn block" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${list.length}`}</button>}
      <p className="hint">“From” prices are the lowest published rate, usually sharing a room, before taxes. They change by date.</p>
    </section>
  );
}
