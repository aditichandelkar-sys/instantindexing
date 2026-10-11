import { NextRequest, NextResponse } from 'next/server';
import { processIndexingBatch } from '@/lib/indexing-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch (parseErr) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request payload' },
        { status: 400 }
      );
    }

    const rawUrls = body?.urls;
    let urlList: string[] = [];

    if (Array.isArray(rawUrls)) {
      urlList = rawUrls.map(u => String(u).trim()).filter(Boolean);
    } else if (typeof rawUrls === 'string') {
      urlList = rawUrls.split(/\r?\n/).map(u => u.trim()).filter(Boolean);
    }

    if (!urlList || urlList.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please provide at least one URL to submit' },
        { status: 400 }
      );
    }

    if (urlList.length > 200) {
      return NextResponse.json(
        { success: false, error: 'Maximum 200 URLs allowed per batch' },
        { status: 400 }
      );
    }

    const mode = body?.mode === 'gsc_property' ? 'gsc_property' : 'third_party';
    const batch = await processIndexingBatch(urlList, { mode });

    // Safe diagnostic logging (batch ID and count only, no tokens/secrets)
    console.log(`[SUBMIT] Successfully accepted and stored batch ${batch.batchId} (${batch.accepted} URLs)`);

    return NextResponse.json({
      success: true,
      batch_id: batch.batchId,
      accepted: batch.accepted,
      status: 'Processed',
      processingTimeMs: batch.processingTimeMs,
      batch: batch,
    });
  } catch (error: any) {
    const errorMsg = error?.message || 'Internal server error';
    console.error('[SUBMIT_ERROR]', errorMsg);
    const isValidationErr = errorMsg.includes('valid format') || errorMsg.includes('No valid HTTP');
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: isValidationErr ? 400 : 500 }
    );
  }
}
