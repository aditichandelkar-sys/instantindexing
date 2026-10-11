import { NextRequest, NextResponse } from 'next/server';
import { fetchRemoteFeedUrls, parseCsvUrls, parseRawTextUrls } from '@/lib/url-importer';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feedUrl, csvContent, rawText } = body;

    if (feedUrl) {
      try {
        const importRes = await fetchRemoteFeedUrls(feedUrl);
        return NextResponse.json({
          success: true,
          sourceType: importRes.sourceType,
          totalFound: importRes.totalFound,
          urls: importRes.validUrls,
          errors: importRes.errors,
        });
      } catch (feedErr: any) {
        return NextResponse.json(
          { success: false, error: feedErr.message || 'Failed to fetch and parse feed' },
          { status: 400 }
        );
      }
    }

    if (csvContent) {
      const urls = parseCsvUrls(csvContent);
      return NextResponse.json({
        success: true,
        sourceType: 'csv_text',
        totalFound: urls.length,
        urls: urls.slice(0, 200),
      });
    }

    if (rawText) {
      const urls = parseRawTextUrls(rawText);
      return NextResponse.json({
        success: true,
        sourceType: 'raw_text',
        totalFound: urls.length,
        urls: urls.slice(0, 200),
      });
    }

    return NextResponse.json(
      { success: false, error: 'Please provide either feedUrl, csvContent, or rawText' },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Import error: ' + (err.message || 'Server error') },
      { status: 500 }
    );
  }
}
