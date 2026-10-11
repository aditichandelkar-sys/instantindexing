import { NextRequest, NextResponse } from 'next/server';
import { getBatches } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const batches = await getBatches();
    const found = batches.find(b => b.batchId === params.id);
    if (!found) {
      return NextResponse.json({ error: 'Batch ID not found' }, { status: 404 });
    }
    return NextResponse.json({
      batch_id: found.batchId,
      status: found.status,
      total: found.totalUrls,
      accepted: found.accepted,
      items: found.items,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
