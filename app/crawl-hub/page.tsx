import { Metadata } from 'next';
import { getBatches } from '@/lib/storage';
import CrawlHubClient from './CrawlHubClient';

export const metadata: Metadata = {
  title: 'Googlebot High-Speed Crawl Gateway | Index Metrix Hub',
  description: 'Instant URL syndication and crawl acceleration hub for search crawlers.',
  robots: {
    index: true,
    follow: true,
  },
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function CrawlHubPage() {
  const allUrls: any[] = [];
  const seen = new Set<string>();
  let loadError: string | null = null;

  try {
    const batches = await getBatches();
    for (const b of (batches || [])) {
      for (const item of (b.items || [])) {
        if (!item || !item.url) continue;
        const norm = item.url.trim();
        if (!seen.has(norm)) {
          seen.add(norm);
          allUrls.push({
            url: norm,
            trackingId: item.trackingId || '',
            category: item.category || { label: 'Link', type: 'backlink' },
            status: item.status || 'Processed',
            submittedAt: item.submittedAt || b.createdAt,
            batchId: b.batchId,
          });
          if (allUrls.length >= 500) break;
        }
      }
      if (allUrls.length >= 500) break;
    }
  } catch (err: any) {
    console.error('[CrawlHubPage] Failed to load batches from storage:', err.message);
    loadError = err.message || 'Unable to retrieve queued URLs from persistent storage.';
  }

  return <CrawlHubClient initialUrls={allUrls} initialError={loadError} />;
}
