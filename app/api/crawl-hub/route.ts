import { NextResponse } from 'next/server';
import { getBatches } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const batches = await getBatches();
    const seen = new Set<string>();
    const allUrls: any[] = [];

    // Traverse batches (newest first)
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

    return NextResponse.json({
      success: true,
      totalUrls: allUrls.length,
      urls: allUrls,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API /api/crawl-hub] Error loading queued URLs:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch queued URLs from storage' },
      { status: 500 }
    );
  }
}
