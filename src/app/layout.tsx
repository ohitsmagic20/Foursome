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
import UpdateBanner from '@/components/UpdateBanner';
import OldDomain from '@/components/OldDomain';
import ErrorReporter from '@/components/ErrorReporter';

export const metadata: Metadata = {
  title: 'Foresome',
  description: 'Plan a golf trip with your group. Vote on dates, destination, lodging and tee times, and line up everyone’s flights.',
  applicationName: 'Foresome',
  appleWebApp: { capable: true, title: 'Foresome', statusBarStyle: 'default' },
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
      <body>{children}<UpdateBanner /><OldDomain /><ErrorReporter /></body>
    </html>
  );
}
