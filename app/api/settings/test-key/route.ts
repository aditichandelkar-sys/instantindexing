import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAccessToken, publishToGoogleIndexingApi } from '@/lib/indexing-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let { serviceAccount } = await request.json();
    if (typeof serviceAccount === 'string') serviceAccount = JSON.parse(serviceAccount);
    if (!serviceAccount || !serviceAccount.client_email || !serviceAccount.private_key) {
      return NextResponse.json({ error: 'Missing client_email or private_key in Service Account JSON' }, { status: 400 });
    }

    const token = await getGoogleAccessToken(serviceAccount);
    const testPublish = await publishToGoogleIndexingApi('https://example.com/test-verify', serviceAccount, 'URL_UPDATED');

    return NextResponse.json({
      success: true,
      message: 'Google Cloud Authentication successful!',
      client_email: serviceAccount.client_email,
      project_id: serviceAccount.project_id,
      tokenAcquired: !!token,
      googleResponse: testPublish,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Google API Connection failed: ' + err.message },
      { status: 400 }
    );
  }
}
