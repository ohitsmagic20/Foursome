import type { Metadata, Viewport } from 'next';
// Fonts are bundled with the app (no request to Google at run time).
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import '@fontsource/instrument-sans/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Foursome',
  description: 'Plan a golf trip with your group. Vote on dates, destination, lodging and tee times, and line up everyone’s flights.',
  applicationName: 'Foursome',
  appleWebApp: { capable: true, title: 'Foursome', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f4ee' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1511' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
