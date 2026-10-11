import { NextRequest, NextResponse } from 'next/server';
import { processIndexingBatch } from '@/lib/indexing-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();
    let urlList: string[] = [];

    if (Array.isArray(urls)) {
      urlList = urls;
    } else if (typeof urls === 'string') {
      urlList = urls.split(/\r?\n/).map(u => u.trim()).filter(Boolean);
    }

    if (!urlList || urlList.length === 0) {
      return NextResponse.json({ error: 'Please provide at least one URL to submit' }, { status: 400 });
    }

    if (urlList.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 URLs allowed per batch' }, { status: 400 });
    }

    const batch = await processIndexingBatch(urlList);
    return NextResponse.json({
      success: true,
      batch_id: batch.batchId,
      accepted: batch.accepted,
      status: 'Processed',
      processingTimeMs: batch.processingTimeMs,
      batch: batch,
    });
  } catch (error: any) {
    console.error('Error submitting batch:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
