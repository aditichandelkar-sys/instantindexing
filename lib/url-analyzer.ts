import dns from 'dns';
import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface TechnicalAnalysis {
  url: string;
  finalUrl: string;
  statusCode: number;
  isIndexable: boolean;
  verdict:
    | 'indexable'
    | 'blocked_noindex'
    | 'blocked_robots'
    | 'redirect'
    | 'client_error'
    | 'server_error'
    | 'unreachable'
    | 'ssrf_blocked';
  verdictReason: string;
  canonicalUrl: string | null;
  pageTitle: string | null;
  metaRobots: string | null;
  xRobotsTag: string | null;
  robotsTxtAllowed: boolean;
  redirectChain: string[];
  contentType: string | null;
  responseTimeMs: number;
  resolvedIp?: string;
  inspectedAt: string;
}

// Check if an IP address belongs to private, loopback, link-local, or cloud metadata ranges
export function isPrivateOrReservedIp(ip: string): boolean {
  // IPv6 checks
  if (ip === '::1' || ip === '::' || ip.toLowerCase() === '0:0:0:0:0:0:0:1') return true;
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true; // Unique local fc00::/7
  if (ip.toLowerCase().startsWith('fe8') || ip.toLowerCase().startsWith('fe9') || ip.toLowerCase().startsWith('fea') || ip.toLowerCase().startsWith('feb')) return true; // Link-local fe80::/10

  // IPv4 checks
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  const [a, b, c, d] = parts;

  if (a === 0) return true; // 0.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 Loopback
  if (a === 10) return true; // 10.0.0.0/8 Private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 Private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 Private
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 Link-local / Cloud Metadata (169.254.169.254)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 Carrier-grade NAT
  if (a >= 224) return true; // Multicast & Reserved (224.0.0.0/4 and 240.0.0.0/4)

  return false;
}

// Safe DNS resolution verifying no resolved address is private/reserved
export async function resolveSafeIp(hostname: string): Promise<string> {
  // Disallow obvious local hostnames
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === 'metadata.google.internal' ||
    lower === 'instance-data'
  ) {
    throw new Error(`Hostname ${hostname} resolves to prohibited local/internal network`);
  }

  const lookupResult = await dns.promises.lookup(hostname, { all: true });
  if (!lookupResult || lookupResult.length === 0) {
    throw new Error(`Hostname ${hostname} could not be resolved`);
  }

  for (const entry of lookupResult) {
    if (isPrivateOrReservedIp(entry.address)) {
      throw new Error(`Hostname ${hostname} resolved to prohibited private IP address (${entry.address})`);
    }
  }

  return lookupResult[0].address;
}

// Fetch with redirect limit, SSRF protection per hop, and max size cap (1MB)
interface SafeFetchResult {
  statusCode: number;
  finalUrl: string;
  redirectChain: string[];
  headers: Record<string, string>;
  body: string;
  responseTimeMs: number;
  resolvedIp: string;
}

async function safeFetchUrl(initialUrl: string, maxRedirects: number = 5): Promise<SafeFetchResult> {
  let currentUrl = initialUrl;
  const redirectChain: string[] = [];
  const startTime = Date.now();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const parsed = new URL(currentUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }

    const resolvedIp = await resolveSafeIp(parsed.hostname);

    const result = await new Promise<{
      statusCode: number;
      headers: Record<string, string>;
      body: string;
      redirectLocation?: string;
    }>((resolve, reject) => {
      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;

      const req = client.request(
        currentUrl,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; IndexMetrixBot/1.0; +https://indexmetrixx.vercel.app/robots.txt)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf;q=0.8,*/*;q=0.7',
            'Accept-Encoding': 'identity',
            'Connection': 'close',
          },
          timeout: 7000,
        },
        (res) => {
          const headers: Record<string, string> = {};
          for (const [key, val] of Object.entries(res.headers)) {
            if (val) headers[key.toLowerCase()] = Array.isArray(val) ? val.join(', ') : val;
          }

          const statusCode = res.statusCode || 0;

          // Check redirect
          if (statusCode >= 300 && statusCode < 400 && headers['location']) {
            res.resume(); // Discard stream
            return resolve({
              statusCode,
              headers,
              body: '',
              redirectLocation: headers['location'],
            });
          }

          let bodyBuffer = '';
          let totalBytes = 0;
          const maxBytes = 1024 * 1024; // 1 MB cap

          res.on('data', (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes <= maxBytes) {
              bodyBuffer += chunk.toString('utf8');
            } else {
              res.destroy(); // Abort reading excessively large response
              resolve({ statusCode, headers, body: bodyBuffer });
            }
          });

          res.on('end', () => {
            resolve({ statusCode, headers, body: bodyBuffer });
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timed out after 7000ms for ${currentUrl}`));
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });

    if (result.redirectLocation) {
      redirectChain.push(currentUrl);
      const nextUrl = new URL(result.redirectLocation, currentUrl).href;
      currentUrl = nextUrl;
      continue;
    }

    return {
      statusCode: result.statusCode,
      finalUrl: currentUrl,
      redirectChain,
      headers: result.headers,
      body: result.body,
      responseTimeMs: Date.now() - startTime,
      resolvedIp,
    };
  }

  throw new Error(`Too many redirects (exceeded limit of ${maxRedirects})`);
}

// Robots.txt check for Googlebot / User-agent: *
async function checkRobotsTxt(origin: string, pathname: string): Promise<boolean> {
  try {
    const robotsUrl = new URL('/robots.txt', origin).href;
    const fetchRes = await safeFetchUrl(robotsUrl, 2);
    if (fetchRes.statusCode !== 200 || !fetchRes.body) {
      return true; // If robots.txt doesn't exist (e.g. 404), crawling is allowed
    }

    const lines = fetchRes.body.split(/\r?\n/);
    let currentUserAgentApplies = false;
    let isDisallowed = false;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const lower = line.toLowerCase();
      if (lower.startsWith('user-agent:')) {
        const agent = lower.replace('user-agent:', '').trim();
        currentUserAgentApplies = agent === '*' || agent.includes('googlebot');
        continue;
      }

      if (currentUserAgentApplies) {
        if (lower.startsWith('disallow:')) {
          const rulePath = line.substring(line.indexOf(':') + 1).trim();
          if (!rulePath) {
            isDisallowed = false; // Disallow: (empty) means allow all
          } else if (rulePath === '/' || pathname.startsWith(rulePath)) {
            isDisallowed = true;
          }
        } else if (lower.startsWith('allow:')) {
          const rulePath = line.substring(line.indexOf(':') + 1).trim();
          if (rulePath && pathname.startsWith(rulePath)) {
            isDisallowed = false; // Explicit allow takes precedence
          }
        }
      }
    }

    return !isDisallowed;
  } catch {
    return true; // Fail-open on robots.txt fetch error
  }
}

// Parse basic HTML metadata without external DOM parser
function parseHtmlMetadata(html: string): {
  title: string | null;
  canonical: string | null;
  metaRobots: string | null;
} {
  let title: string | null = null;
  let canonical: string | null = null;
  let metaRobots: string | null = null;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].trim().replace(/\s+/g, ' ');
  }

  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  if (canonicalMatch && canonicalMatch[1]) {
    canonical = canonicalMatch[1].trim();
  }

  const robotsMatch = html.match(/<meta[^>]+name=["'](robots|googlebot)["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["'](robots|googlebot)["']/i);
  if (robotsMatch) {
    metaRobots = (robotsMatch[1].includes('content') ? robotsMatch[1] : robotsMatch[2] || '').trim();
  }

  return { title, canonical, metaRobots };
}

// Master technical indexability analysis function
export async function analyzeUrl(targetUrl: string): Promise<TechnicalAnalysis> {
  const startTime = Date.now();
  const inspectedAt = new Date().toISOString();

  // 1. Initial format validation
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`);
    }
  } catch (err: any) {
    return {
      url: targetUrl,
      finalUrl: targetUrl,
      statusCode: 0,
      isIndexable: false,
      verdict: 'unreachable',
      verdictReason: `Invalid URL syntax: ${err.message}`,
      canonicalUrl: null,
      pageTitle: null,
      metaRobots: null,
      xRobotsTag: null,
      robotsTxtAllowed: false,
      redirectChain: [],
      contentType: null,
      responseTimeMs: 0,
      inspectedAt,
    };
  }

  // 2. SSRF Protection & Safe Fetch
  let fetchResult: SafeFetchResult;
  try {
    fetchResult = await safeFetchUrl(targetUrl);
  } catch (err: any) {
    const isSsrf = err.message.includes('prohibited') || err.message.includes('private IP') || err.message.includes('local/internal');
    return {
      url: targetUrl,
      finalUrl: targetUrl,
      statusCode: 0,
      isIndexable: false,
      verdict: isSsrf ? 'ssrf_blocked' : 'unreachable',
      verdictReason: isSsrf ? 'Prohibited target: Private or internal network destination blocked for SSRF security.' : err.message,
      canonicalUrl: null,
      pageTitle: null,
      metaRobots: null,
      xRobotsTag: null,
      robotsTxtAllowed: false,
      redirectChain: [],
      contentType: null,
      responseTimeMs: Date.now() - startTime,
      inspectedAt,
    };
  }

  const { statusCode, finalUrl, redirectChain, headers, body, responseTimeMs, resolvedIp } = fetchResult;
  const contentType = headers['content-type'] || null;
  const xRobotsTag = headers['x-robots-tag'] || null;

  // 3. HTML Metadata Parsing
  const { title, canonical, metaRobots } = parseHtmlMetadata(body);

  // 4. Robots.txt check
  const robotsAllowed = await checkRobotsTxt(parsed.origin, parsed.pathname);

  // 5. Indexability Evaluation
  let isIndexable = true;
  let verdict: TechnicalAnalysis['verdict'] = 'indexable';
  let verdictReason = 'URL is publicly accessible and returns 200 OK without crawl or index restrictions.';

  const isNoindexHeader = xRobotsTag && xRobotsTag.toLowerCase().includes('noindex');
  const isNoindexMeta = metaRobots && metaRobots.toLowerCase().includes('noindex');

  if (statusCode >= 400 && statusCode < 500) {
    isIndexable = false;
    verdict = 'client_error';
    verdictReason = `HTTP ${statusCode} client error. Search engines will not index dead or forbidden pages.`;
  } else if (statusCode >= 500) {
    isIndexable = false;
    verdict = 'server_error';
    verdictReason = `HTTP ${statusCode} server error. Search engine bots cannot retrieve page content.`;
  } else if (redirectChain.length > 0) {
    if (statusCode >= 200 && statusCode < 300) {
      verdict = 'redirect';
      verdictReason = `URL redirected (${redirectChain.length} hop${redirectChain.length > 1 ? 's' : ''}) to ${finalUrl}. Search engines will evaluate the destination URL.`;
    }
  }

  if (isNoindexHeader || isNoindexMeta) {
    isIndexable = false;
    verdict = 'blocked_noindex';
    verdictReason = `Page explicitly instructs search engines not to index via ${
      isNoindexHeader ? 'X-Robots-Tag header' : 'meta robots tag'
    } (noindex directive found).`;
  } else if (!robotsAllowed) {
    isIndexable = false;
    verdict = 'blocked_robots';
    verdictReason = `Robots.txt on ${parsed.hostname} disallows crawlers from accessing path "${parsed.pathname}".`;
  }

  return {
    url: targetUrl,
    finalUrl,
    statusCode,
    isIndexable,
    verdict,
    verdictReason,
    canonicalUrl: canonical,
    pageTitle: title,
    metaRobots,
    xRobotsTag,
    robotsTxtAllowed: robotsAllowed,
    redirectChain,
    contentType,
    responseTimeMs,
    resolvedIp,
    inspectedAt,
  };
}
