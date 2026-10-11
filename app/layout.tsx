import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://indexmetrixx.vercel.app'),
  title: 'Index Metrix — Fast URL & Backlink Indexer for Google',
  description:
    'Instant URL and third-party backlink indexing tool for SEO. Submit bulk URLs to Google priority queues and inspect verified properties using Google Search Console API.',
  verification: {
    google: [
      '2ZIhjlyHdAOoJmOXMW2uid0PIDG2L1vr6wwcFbj7OBU',
      'zHqFSyKmk8Qlwtrft-7XyX6zBMAKN2URDKU09akK7qI',
    ],
  },
  alternates: {
    canonical: 'https://indexmetrixx.vercel.app',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
