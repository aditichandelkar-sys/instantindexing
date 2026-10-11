import { NextRequest, NextResponse } from 'next/server';
import { decryptSession, getValidAccessToken, submitSitemap, encryptSession } from '@/lib/gsc-auth';
import { getGscAuthFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { siteUrl, feedpath } = await request.json();

    if (!siteUrl || !feedpath) {
      return NextResponse.json(
        { error: 'Both siteUrl and feedpath (e.g. sitemap.xml) are required.' },
        { status: 400 }
      );
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

    const { token, updatedSession } = await getValidAccessToken(session);
    const result = await submitSitemap(token, siteUrl, feedpath);

    const response = NextResponse.json(result, { status: result.success ? 200 : 400 });

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
      { error: 'Sitemap submission error: ' + (err.message || 'Server error') },
      { status: 500 }
    );
  }
}
