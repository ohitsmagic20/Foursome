import { TEMPLATES, templateCost, type TripTemplate } from '@/data/templates';
import { money } from '@/lib/shared';

const range = ([a, b]: [number, number]) => (a === b ? money(a) : `${money(a)}–${money(b).replace('$', '')}`);

/** One trip idea as a tappable card. */
export function IdeaCard({ t }: { t: TripTemplate }) {
  const c = templateCost(t);
  return (
    <a className="idea-card" href={`/ideas/${t.slug}`}>
      <div className="eyebrow">{t.community ? `Group of ${t.community.group} · ${t.community.month}` : `${t.state} · ${t.nights + 1} days`}</div>
      <div className="idea-name">{t.name}</div>
      <div className="row-meta">{t.tagline}</div>
      <div className="idea-cost"><strong>{range(c.total)}</strong> <span className="row-meta">per golfer, before flights{t.community ? ', what they paid' : ''}</span></div>
    </a>
  );
}

/** Horizontal strip of trip ideas for the home screen. */
export function IdeaStrip() {
  return (
    <section className="section">
      <div className="section-head"><h2>Trip ideas</h2><a className="link-btn" href="/ideas">See all</a></div>
      <div className="idea-strip">
        {TEMPLATES.map((t) => <IdeaCard key={t.slug} t={t} />)}
      </div>
    </section>
  );
}

export { range as moneyRange };
