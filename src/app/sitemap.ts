import type { MetadataRoute } from 'next';
import { TEMPLATES } from '@/data/templates';
import { sharedIdeas } from '@/lib/ideas';

export const revalidate = 3600;

const BASE = 'https://www.foresomes.net';

// Public pages for search engines: the home page, trip ideas, and the legal pages.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const shared = await sharedIdeas(200).catch(() => []);
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/ideas`, changeFrequency: 'weekly', priority: 0.9 },
    ...TEMPLATES.map((t) => ({ url: `${BASE}/ideas/${t.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...shared.map((t) => ({ url: `${BASE}/ideas/${t.slug}`, changeFrequency: 'yearly' as const, priority: 0.5 })),
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
