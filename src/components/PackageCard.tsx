import type { Report, StayPlay } from '@/data/packages';
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

/** What golfers actually paid here: the overall range, then each trip with what it covered and a link. */
function Reported({ r }: { r: Report[] }) {
  const low = Math.min(...r.map((x) => x.low)), high = Math.max(...r.map((x) => x.high));
  const range = (a: number, b: number) => (a === b ? $(a) : `${$(a)}–${$(b).slice(1)}`);
  return (
    <div className="pkg-rep">
      <div className="pkg-rep-head">What golfers paid</div>
      <div className="pkg-rep-num">{range(low, high)} per golfer</div>
      <ul className="pkg-rep-list">
        {r.map((x) => (
          <li key={x.url + x.low}>
            <b>{range(x.low, x.high)}</b> · {x.shape} · {x.when}
            <div className="row-meta">{x.covers}. <a href={x.url} target="_blank" rel="noopener noreferrer">{x.label}</a></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
