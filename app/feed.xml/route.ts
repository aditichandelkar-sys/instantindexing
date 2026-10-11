import { NextResponse } from 'next/server';
import { getBatches } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const batches = getBatches();
  const items: any[] = [];
  batches.slice(0, 5).forEach(b => {
    (b.items || []).forEach(item => {
      if (items.length < 100) items.push(item);
    });
  });

  const baseUrl = 'https://indexmetrixx.vercel.app';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Index Metrix Syndication Feed</title>
    <link>${baseUrl}/crawl-hub</link>
    <description>Fast backlink and URL indexing feed for search bots</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`;

  items.forEach(item => {
    xml += `
    <item>
      <title>${escapeXml(item.category?.label || 'URL')}: ${escapeXml(item.url)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid>${escapeXml(item.trackingId)}</guid>
      <pubDate>${new Date(item.submittedAt).toUTCString()}</pubDate>
      <description>Submitted for instant indexing via Index Metrix pipeline.</description>
    </item>`;
  });

  xml += `
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 's-maxage=60, stale-while-revalidate',
    },
  });
}

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
