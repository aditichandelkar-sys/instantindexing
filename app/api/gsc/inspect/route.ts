import { NextRequest, NextResponse } from 'next/server';
import {
  decryptSession,
  getValidAccessToken,
  inspectUrl,
  urlBelongsToProperty,
  encryptSession,
} from '@/lib/gsc-auth';
import { getGscAuthFile } from '@/lib/storage';
import { GscInspectionResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteUrl, urls } = body;

    if (!siteUrl) {
      return NextResponse.json(
        { error: 'Please select an authorized Search Console property first.' },
        { status: 400 }
      );
    }

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'Please provide at least one URL to inspect.' },
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
      return NextResponse.json(
        { error: 'Google Search Console is not connected.' },
        { status: 401 }
      );
    }

    const { token, updatedSession } = await getValidAccessToken(session);

    const uniqueUrls = Array.from(new Set(urls.map((u: string) => (u || '').trim()).filter(Boolean)));
    const results: GscInspectionResult[] = [];

    for (const testUrl of uniqueUrls) {
      if (!urlBelongsToProperty(testUrl, siteUrl)) {
        results.push({
          url: testUrl,
          siteUrl: siteUrl,
          verdict: 'FAIL',
          coverageState: `URL does not belong to authorized property "${siteUrl}".`,
          robotsTxtState: 'BLOCKED',
          indexingState: 'FAILED',
          lastCrawlTime: 'N/A',
          pageFetchState: 'NOT_ATTEMPTED',
          googleCanonical: 'N/A',
          userCanonical: 'N/A',
          indexStatus: 'Failed',
          inspectedAt: new Date().toISOString(),
          error: `Domain mismatch for property ${siteUrl}`,
        });
        continue;
      }

      const inspectRes = await inspectUrl(token, siteUrl, testUrl);
      results.push(inspectRes);
    }

    const response = NextResponse.json({ siteUrl, results });

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
      { error: 'URL inspection error: ' + (err.message || 'Server error') },
      { status: 500 }
    );
  }
}
