import { NextResponse } from 'next/server';
import { getBatches } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const batches = getBatches();
  const summary = batches.map(b => ({
    batchId: b.batchId,
    totalUrls: b.totalUrls,
    status: b.status,
    accepted: b.accepted,
    createdAt: b.createdAt,
    processingTimeMs: b.processingTimeMs,
    isLiveGoogleApi: b.isLiveGoogleApi,
    sampleUrls: (b.items || []).slice(0, 3).map(i => ({ url: i.url, category: i.category })),
  }));

  return NextResponse.json({ batches: summary });
}
