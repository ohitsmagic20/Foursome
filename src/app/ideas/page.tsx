import type { Metadata } from 'next';
import { TEMPLATES } from '@/data/templates';
import { IdeaCard } from '@/components/IdeaCards';
import { sharedIdeas } from '@/lib/ideas';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Golf trip ideas · Foresome',
  description: 'Ready-made golf trip itineraries with courses, tee times and estimated costs: Kohler & Erin Hills, Sand Valley, Pinehurst, Myrtle Beach, Scottsdale, Bandon Dunes and more.',
};

export default async function Ideas() {
  const shared = await sharedIdeas(30).catch(() => []);
  return (
    <div className="app no-tabs">
      <header className="top">
        <div style={{ minWidth: 0 }}>
          <a className="eyebrow" href="/" style={{ textDecoration: 'none' }}>‹ Foresome</a>
          <h1>Golf trip ideas</h1>
          <p className="sub" style={{ marginTop: 6 }}>Ready-made itineraries with real courses, tee times and estimated costs. Start one and your group votes on the details.</p>
        </div>
      </header>
      <main className="idea-grid">
        {TEMPLATES.map((t) => <IdeaCard key={t.slug} t={t} />)}
      </main>
      {shared.length > 0 && (
        <section className="section" style={{ marginTop: 28 }}>
          <h2>Shared by Foresome groups</h2>
          <div className="idea-grid">{shared.map((t) => <IdeaCard key={t.slug} t={t} />)}</div>
        </section>
      )}
      <p className="hint" style={{ marginTop: 20 }}>Prices are per golfer and change by season. Each idea lists where its prices came from and when.</p>
    </div>
  );
}
