import type { Metadata } from 'next';
import TripApp from '@/components/TripApp';
import { tripByCode } from '@/lib/server';
import { tripPreview } from '@/lib/preview';

// Link previews in group texts: "Spring Golf Trip · Matt invited you to plan it…".
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  try {
    const trip = await tripByCode(code);
    const p = await tripPreview(trip);
    const facts = [p.place, p.dates, `${p.count} going`].filter(Boolean).join(' · ');
    const description = `${p.organizer ? `${p.organizer} invited you.` : 'You’re invited.'} ${facts}. Vote on dates, where to stay and where to play.`;
    return {
      title: `${trip.name} · Foresome`,
      description,
      robots: { index: false, follow: false },
      openGraph: { title: trip.name, description, siteName: 'Foresome', type: 'website' },
      twitter: { card: 'summary_large_image', title: trip.name, description },
    };
  } catch {
    return { title: 'Foresome', robots: { index: false, follow: false } };
  }
}

export default async function TripPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <TripApp code={code} />;
}
