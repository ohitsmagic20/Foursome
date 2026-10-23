import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TEMPLATES, templateBySlug, templateCost } from '@/data/templates';
import { moneyRange } from '@/components/IdeaCards';
import { TripMap } from '@/components/TripMap';

export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const t = templateBySlug((await params).slug);
  if (!t) return {};
  return {
    title: `${t.name} golf trip itinerary · Foresome`,
    description: `${t.nights + 1}-day ${t.name} golf trip: ${t.rounds.map((r) => r.course).join(', ')}. Tee times, green fees and estimated cost per golfer.`,
  };
}

export default async function Idea({ params }: { params: Promise<{ slug: string }> }) {
  const t = templateBySlug((await params).slug);
  if (!t) notFound();
  const c = templateCost(t);
  const days = Array.from({ length: t.nights + 1 }, (_, i) => i + 1);

  return (
    <div className="app no-tabs">
      <header className="top">
        <div style={{ minWidth: 0 }}>
          <a className="eyebrow" href="/ideas" style={{ textDecoration: 'none' }}>‹ Trip ideas</a>
          <h1>{t.name}</h1>
          <p className="sub" style={{ marginTop: 6 }}>{t.state} · {t.nights} nights · {t.rounds.length} rounds</p>
        </div>
      </header>

      <main className="stack">
        <p style={{ margin: 0 }}>{t.summary}</p>

        <section className="plan">
          <div className="plan-head">
            <div className="eyebrow">Per golfer, before flights</div>
            <div className="plan-title">{moneyRange(c.total)}</div>
            <div className="row-meta">Golf {moneyRange(c.golf)} · stay {moneyRange(c.stay)} · food {moneyRange(c.food)}</div>
          </div>
          <a className="btn primary block" href={`/?template=${t.slug}#start`}>Start a trip from this</a>
        </section>

        <TripMap place={t.destination} airport={t.airports[0]} stops={t.rounds.map((r, i) => ({ name: r.course, label: String(i + 1) }))} />

        <section className="section">
          <h2>The itinerary</h2>
          <div className="list">
            {days.map((d) => {
              const rs = t.rounds.filter((r) => r.day === d);
              return (
                <div className="row" key={d} style={{ alignItems: 'flex-start' }}>
                  <div className="idea-day">Day {d}</div>
                  <div className="grow" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {rs.length === 0 && <div className="row-meta">{d === 1 ? 'Travel in' : d === t.nights + 1 ? 'Travel home' : 'Open day'}</div>}
                    {rs.map((r) => (
                      <div key={r.course}>
                        <div className="row-title">{r.time} · {r.course}</div>
                        <div className="row-meta">{r.fee.verified ? '' : '~'}{moneyRange([r.fee.low, r.fee.high])}</div>
                        {r.access && <div className="row-meta">{r.access}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="section">
          <h2>Getting there</h2>
          <div className="card stack" style={{ gap: 8 }}>
            <div><span className="row-title">Fly into </span>{t.airports.join(' or ')}</div>
            <div><span className="row-title">Best time </span>{t.bestMonths}</div>
            <div><span className="row-title">Stay </span>{t.lodging.note} <span className="row-meta">~{moneyRange([t.lodging.perNight.low, t.lodging.perNight.high])}/person/night</span></div>
          </div>
        </section>

        <section className="section">
          <h2>Good to know</h2>
          <ul className="idea-tips">{t.tips.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>

        <section className="section">
          <p className="hint">
            Prices checked Oct 2026 · {t.sources.map((s, i) => <span key={s.url}>{i ? ', ' : ''}<a href={s.url} target="_blank" rel="noopener noreferrer">{s.label.split(':')[0]}</a></span>)}
          </p>
        </section>

        <a className="btn primary block" href={`/?template=${t.slug}#start`}>Start a trip from this</a>
        <p className="legal-links"><a href="/ideas">More trip ideas</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
      </main>
    </div>
  );
}
