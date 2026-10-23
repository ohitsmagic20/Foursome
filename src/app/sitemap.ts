import type { MetadataRoute } from 'next';
import { TEMPLATES } from '@/data/templates';

const BASE = 'https://www.foresomes.net';

// Public pages for search engines: the home page, trip ideas, and the legal pages.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/ideas`, changeFrequency: 'weekly', priority: 0.9 },
    ...TEMPLATES.map((t) => ({ url: `${BASE}/ideas/${t.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/terms`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
