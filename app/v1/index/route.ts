import { NextRequest, NextResponse } from 'next/server';
import { processIndexingBatch } from '@/lib/indexing-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'Field "urls" must be a non-empty array of URLs' }, { status: 400 });
    }

    const batch = await processIndexingBatch(urls);
    return NextResponse.json({
      batch_id: batch.batchId,
      accepted: batch.accepted,
      status: 'Processed',
      tracking_ids: batch.items.map(i => ({ url: i.url, tracking_id: i.trackingId })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
