import type { StayPlay } from '@/data/packages';
import { priceLabel, tripEstimate } from '@/data/packages';

/** One stay-and-play package: where, which courses, the shape of the deal, and a link to book. */
export function PackageCard({ p, miles }: { p: StayPlay; miles?: number }) {
  const est = tripEstimate(p);
  const courses = p.courses.length > 6 ? [...p.courses.slice(0, 6), `${p.courses.length - 6} more`] : p.courses;
  return (
    <div className="card pkg">
      <div className="pkg-head">
        <div style={{ minWidth: 0 }}>
          <div className="row-title">{p.resort}</div>
          <div className="row-meta">{p.name} · {p.city}, {p.state}{miles !== undefined ? ` · ${miles} mi` : ''}</div>
        </div>
        <div className={`pkg-price${p.price ? '' : ' quote'}`}>{priceLabel(p)}</div>
      </div>
      <div className="pkg-courses">{courses.join(' · ')}</div>
      <div className="row-meta">{[p.shape || 'Nights and rounds set when you ask for a quote', p.includes].filter(Boolean).join('. ').replace(/\.\./g, '.')}</div>
      {est && <div className="pkg-est">{est}</div>}
      {p.price?.note && <div className="row-meta">{p.price.note}</div>}
      {p.detail && <div className="row-meta">{p.detail}</div>}
      {p.reported && <Reported r={p.reported} />}
      <div className="pkg-foot">
        <span className="row-meta">Checked {p.checked} · {p.source}</span>
        <a className="btn small" href={p.url} target="_blank" rel="noopener noreferrer">{p.price ? 'See rates' : 'Get a quote'}</a>
      </div>
    </div>
  );
}

const $ = (n: number) => `$${n.toLocaleString('en-US')}`;

/** What golfers actually paid here: a range per golfer, what it covered, and where the numbers come from. */
function Reported({ r }: { r: NonNullable<StayPlay['reported']> }) {
  return (
    <div className="pkg-rep">
      <div className="pkg-rep-head">What golfers paid</div>
      <div className="pkg-rep-num">{r.low === r.high ? $(r.low) : `${$(r.low)}–${$(r.high).slice(1)}`} per golfer <span>· {r.shape} · {r.year}</span></div>
      <div className="row-meta">{r.covers}</div>
      <div className="pkg-rep-src">
        {r.sources.map((s) => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}</a>)}
      </div>
    </div>
  );
}
