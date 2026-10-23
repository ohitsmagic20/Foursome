import type { MetadataRoute } from 'next';

// Trips are private (/t/...), so only the public pages are listed for search engines.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: ['/', '/ideas'], disallow: ['/t/', '/api/', '/profile', '/signin', '/migrate', '/unsubscribe'] }],
    sitemap: 'https://www.foresomes.net/sitemap.xml',
  };
}
