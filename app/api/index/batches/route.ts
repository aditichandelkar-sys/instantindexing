import { NextResponse } from 'next/server';
import { getBatches } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const batches = await getBatches();
    const summary = (batches || []).map(b => ({
      batchId: b.batchId,
      totalUrls: b.totalUrls,
      status: b.status,
      accepted: b.accepted,
      createdAt: b.createdAt,
      processingTimeMs: b.processingTimeMs,
      isLiveGoogleApi: b.isLiveGoogleApi,
      sampleUrls: (b.items || []).slice(0, 3).map(i => ({ url: i.url, category: i.category })),
    }));

    return NextResponse.json({ success: true, batches: summary, totalBatches: summary.length });
  } catch (err: any) {
    console.error('[API /api/index/batches] Error fetching batches:', err.message);
    return NextResponse.json({ success: false, batches: [], error: err.message }, { status: 500 });
  }
}
