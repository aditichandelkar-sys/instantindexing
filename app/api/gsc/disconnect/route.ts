import { NextRequest, NextResponse } from 'next/server';
import { decryptSession, revokeToken } from '@/lib/gsc-auth';
import { getGscAuthFile, clearGscAuthFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let session = null;
  const sessionCookie = request.cookies.get('gsc_session')?.value;
  if (sessionCookie) {
    session = decryptSession(sessionCookie);
  }
  if (!session) {
    session = getGscAuthFile();
  }

  if (session?.tokens?.access_token) {
    try {
      await revokeToken(session.tokens.access_token);
    } catch (e) {}
  }

  clearGscAuthFile();

  const response = NextResponse.json({
    success: true,
    message: 'Google Search Console disconnected successfully.',
  });

  response.cookies.delete('gsc_session');

  return response;
}
