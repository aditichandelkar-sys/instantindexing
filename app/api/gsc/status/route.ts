import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from '@/lib/gsc-auth';
import { getGscAuthFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const isConfigured = !!(clientId && !clientId.includes('your-google-client-id'));

  let session = null;
  const sessionCookie = request.cookies.get('gsc_session')?.value;
  if (sessionCookie) {
    session = decryptSession(sessionCookie);
  }

  if (!session) {
    session = getGscAuthFile();
  }

  if (!session || !session.tokens?.access_token) {
    return NextResponse.json({
      connected: false,
      isConfigured: isConfigured,
      user: null,
    });
  }

  return NextResponse.json({
    connected: true,
    isConfigured: isConfigured,
    connectedAt: session.connectedAt,
    user: session.user || { email: 'Connected User' },
  });
}
