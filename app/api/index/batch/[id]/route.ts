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
      return NextResponse.json({ success: false, error: 'Batch not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, batch: found });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
