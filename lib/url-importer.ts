import { URL } from 'url';
import { resolveSafeIp } from './url-analyzer';

export interface ImportResult {
  sourceType: 'raw_text' | 'sitemap_xml' | 'rss_xml' | 'csv_text';
  totalFound: number;
  validUrls: string[];
  rejectedCount: number;
  errors: string[];
}

// Normalize a URL: trim, ensure http/https, lowercase host, strip trailing hash
export function normalizeUrl(raw: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  // Don't process non-web schemes
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('mailto:')) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  const withProto = lower.startsWith('http://') || lower.startsWith('https://')
    ? trimmed
    : 'https://' + trimmed;

  try {
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null;
    }

    // Lowercase hostname and remove hash fragment (fragments are client-only and not indexed by bots)
    parsed.hash = '';
    return parsed.href;
  } catch {
    return null;
  }
}

// Extract URLs from XML Sitemap (<loc> elements)
export function parseSitemapXml(xmlContent: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc\s*>([^<]+)<\/loc\s*>/gi;
  let match: RegExpExecArray | null;

  while ((match = locRegex.exec(xmlContent)) !== null) {
    const raw = match[1].trim();
    const normalized = normalizeUrl(raw);
    if (normalized) {
      urls.push(normalized);
    }
  }

  return Array.from(new Set(urls));
}

// Extract URLs from RSS or Atom Feed (<link> elements)
export function parseRssXml(xmlContent: string): string[] {
  const urls: string[] = [];

  // Match RSS <item><link>...</link> or Atom <link href="..." />
  const linkTextRegex = /<link\s*>([^<]+)<\/link\s*>/gi;
  let textMatch: RegExpExecArray | null;
  while ((textMatch = linkTextRegex.exec(xmlContent)) !== null) {
    const raw = textMatch[1].trim();
    const normalized = normalizeUrl(raw);
    if (normalized) {
      urls.push(normalized);
    }
  }

  const linkHrefRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let hrefMatch: RegExpExecArray | null;
  while ((hrefMatch = linkHrefRegex.exec(xmlContent)) !== null) {
    const raw = hrefMatch[1].trim();
    const normalized = normalizeUrl(raw);
    if (normalized) {
      urls.push(normalized);
    }
  }

  return Array.from(new Set(urls));
}

// Extract URLs from CSV text (comma, semicolon, or tab separated)
export function parseCsvUrls(csvContent: string): string[] {
  const urls: string[] = [];
  const lines = csvContent.split(/\r?\n/);

  for (const line of lines) {
    const tokens = line.split(/[,;\t]/);
    for (const token of tokens) {
      const clean = token.replace(/^["']|["']$/g, '').trim();
      if (clean.startsWith('http://') || clean.startsWith('https://') || clean.includes('.com') || clean.includes('.org') || clean.includes('.net')) {
        const norm = normalizeUrl(clean);
        if (norm) urls.push(norm);
      }
    }
  }

  return Array.from(new Set(urls));
}

// Extract URLs from plain multi-line string
export function parseRawTextUrls(text: string): string[] {
  const urls: string[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const norm = normalizeUrl(trimmed);
    if (norm) {
      urls.push(norm);
    }
  }

  return Array.from(new Set(urls));
}

// Remote XML/RSS fetcher with SSRF defense
export async function fetchRemoteFeedUrls(feedUrl: string, maxLimit: number = 200): Promise<ImportResult> {
  const normalizedFeed = normalizeUrl(feedUrl);
  if (!normalizedFeed) {
    throw new Error('Invalid feed URL provided');
  }

  const parsed = new URL(normalizedFeed);
  // SSRF defense: check host
  await resolveSafeIp(parsed.hostname);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let xmlText = '';
  try {
    const res = await fetch(normalizedFeed, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IndexMetrixFeedImporter/1.0; +https://indexmetrixx.vercel.app/robots.txt)',
        'Accept': 'application/xml,text/xml,application/rss+xml,application/atom+xml,*/*',
      },
    });

    if (!res.ok) {
      throw new Error(`Feed request failed with HTTP ${res.status}`);
    }

    xmlText = await res.text();
  } finally {
    clearTimeout(timeoutId);
  }

  // Detect whether sitemap or RSS
  const isSitemap = xmlText.includes('<urlset') || xmlText.includes('<sitemapindex') || feedUrl.toLowerCase().includes('sitemap');
  const isRss = xmlText.includes('<rss') || xmlText.includes('<feed') || xmlText.includes('<channel');

  let extracted: string[] = [];
  let sourceType: ImportResult['sourceType'] = 'raw_text';

  if (isSitemap) {
    sourceType = 'sitemap_xml';
    extracted = parseSitemapXml(xmlText);
  } else if (isRss) {
    sourceType = 'rss_xml';
    extracted = parseRssXml(xmlText);
  } else {
    // Fallback: try sitemap first, then RSS, then raw
    extracted = parseSitemapXml(xmlText);
    if (extracted.length === 0) {
      extracted = parseRssXml(xmlText);
    }
    sourceType = 'sitemap_xml';
  }

  const capped = extracted.slice(0, maxLimit);

  return {
    sourceType,
    totalFound: extracted.length,
    validUrls: capped,
    rejectedCount: extracted.length > maxLimit ? extracted.length - maxLimit : 0,
    errors: extracted.length === 0 ? ['No valid URLs could be extracted from the provided feed/sitemap.'] : [],
  };
}
