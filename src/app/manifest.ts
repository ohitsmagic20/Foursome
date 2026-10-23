import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Foresome',
    short_name: 'Foresome',
    description: 'Plan a golf trip with your group.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f2f4ee',
    theme_color: '#1e5a3b',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
