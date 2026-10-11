import { NextRequest, NextResponse } from 'next/server';
import { decryptSession, getValidAccessToken, fetchSearchConsoleSites, encryptSession } from '@/lib/gsc-auth';
import { getGscAuthFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  let session = null;
  const sessionCookie = request.cookies.get('gsc_session')?.value;
  if (sessionCookie) {
    session = decryptSession(sessionCookie);
  }
  if (!session) {
    session = getGscAuthFile();
  }

  if (!session) {
    return NextResponse.json(
      { error: 'Google Search Console is not connected. Please connect your account first.' },
      { status: 401 }
    );
  }

  try {
    const { token, updatedSession } = await getValidAccessToken(session);
    const sites = await fetchSearchConsoleSites(token);

    const response = NextResponse.json({ sites });

    if (updatedSession) {
      response.cookies.set('gsc_session', encryptSession(updatedSession), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to retrieve Search Console sites: ' + (err.message || 'API error') },
      { status: 500 }
    );
  }
}
