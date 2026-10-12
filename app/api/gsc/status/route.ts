import { NextRequest, NextResponse } from 'next/server';
import { decryptSession } from '@/lib/gsc-auth';
import { getGscAuthFile, clearGscAuthFile } from '@/lib/storage';

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

  // Validate that the session has Search Console webmasters scope
  if (session.tokens.scope && !session.tokens.scope.includes('webmasters')) {
    clearGscAuthFile();
    const res = NextResponse.json({
      connected: false,
      isConfigured: isConfigured,
      user: null,
      error: 'Search Console permissions were not granted. Please reconnect.',
    });
    res.cookies.delete('gsc_session');
    return res;
  }

  // Check if access token is expired without any refresh token
  const now = Date.now();
  if (session.tokens.expiry_date && session.tokens.expiry_date <= now && !session.tokens.refresh_token) {
    clearGscAuthFile();
    const res = NextResponse.json({
      connected: false,
      isConfigured: isConfigured,
      user: null,
      error: 'Session expired. Please reconnect.',
    });
    res.cookies.delete('gsc_session');
    return res;
  }

  return NextResponse.json({
    connected: true,
    isConfigured: isConfigured,
    connectedAt: session.connectedAt,
    user: session.user || { email: 'Connected User' },
  });
}
