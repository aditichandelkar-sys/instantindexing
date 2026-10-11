import { NextRequest, NextResponse } from 'next/server';
import { decryptSession, getValidAccessToken, listSitemaps, encryptSession } from '@/lib/gsc-auth';
import { getGscAuthFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const siteUrl = searchParams.get('siteUrl');

  if (!siteUrl) {
    return NextResponse.json({ error: 'Missing siteUrl parameter' }, { status: 400 });
  }

  let session = null;
  const sessionCookie = request.cookies.get('gsc_session')?.value;
  if (sessionCookie) {
    session = decryptSession(sessionCookie);
  }
  if (!session) {
    session = getGscAuthFile();
  }

  if (!session) {
    return NextResponse.json({ error: 'Google Search Console is not connected.' }, { status: 401 });
  }

  try {
    const { token, updatedSession } = await getValidAccessToken(session);
    const sitemaps = await listSitemaps(token, siteUrl);

    const response = NextResponse.json({ siteUrl, sitemaps });

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
      { error: 'Failed to fetch sitemaps: ' + (err.message || 'API error') },
      { status: 500 }
    );
  }
}
