import { BatchItem, BatchRecord } from './types';
import { getCredentials, getBatches, saveBatches } from './storage';
import { analyzeUrl, TechnicalAnalysis } from './url-analyzer';
import { normalizeUrl } from './url-importer';
import { pingWebSubHub, GoogleIndexingApiAdapter, OmegaIndexerAdapter } from './providers';
export { getGoogleAccessToken, publishToGoogleIndexingApi } from './indexing-engine-helpers';

export function detectUrlCategory(url: string) {
  const u = (url || '').toLowerCase();
  if (u.includes('instagram.com/p/') || u.includes('instagram.com/reel/') || u.includes('instagram.com/')) {
    return { type: 'instagram', label: 'Instagram Post / Reel', icon: '📸', color: '#E1306C' };
  }
  if (u.includes('threads.net/@') || u.includes('threads.net/t/')) {
    return { type: 'threads', label: 'Threads Submission', icon: '🧵', color: '#000000' };
  }
  if (u.endsWith('.pdf') || u.includes('.pdf?') || u.includes('issuu.com') || u.includes('scribd.com') || u.includes('slideshare.net') || u.includes('docdroid.net')) {
    return { type: 'pdf', label: 'PDF Submission', icon: '📄', color: '#EF4444' };
  }
  if (u.includes('reddit.com/r/') || u.includes('quora.com') || u.includes('forum') || u.includes('discourse') || u.includes('vbulletin') || u.includes('xenforo') || u.includes('community.')) {
    return { type: 'forum', label: 'Forum Submission', icon: '💬', color: '#F97316' };
  }
  if (u.includes('medium.com') || u.includes('substack.com') || u.includes('notion.site') || u.includes('wordpress.com') || u.includes('blogger.com') || u.includes('blogspot.com')) {
    return { type: 'web20', label: 'Web 2.0 / Blog', icon: '🌐', color: '#10B981' };
  }
  if (u.includes('twitter.com') || u.includes('x.com') || u.includes('facebook.com') || u.includes('linkedin.com') || u.includes('pinterest.com')) {
    return { type: 'social', label: 'Social Profile / Post', icon: '👥', color: '#3B82F6' };
  }
  return { type: 'backlink', label: 'Backlink / Webpage', icon: '🔗', color: '#8B5CF6' };
}

export interface ProcessBatchOptions {
  mode?: 'third_party' | 'gsc_property';
  skipAnalysis?: boolean;
}

export async function processIndexingBatch(
  rawUrls: string[],
  options: ProcessBatchOptions = {}
): Promise<BatchRecord> {
  const creds = getCredentials();
  const activeServiceAccounts = creds.serviceAccounts || [];
  const batchId = 'btch_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
  const startTime = Date.now();
  const mode = options.mode || 'third_party';

  // 1. Strict URL validation, normalization, and deduplication
  const validatedUrls: string[] = [];
  for (const raw of rawUrls) {
    const normalized = normalizeUrl(raw);
    if (normalized) {
      validatedUrls.push(normalized);
    }
  }

  const cleanUrls = Array.from(new Set(validatedUrls));

  if (cleanUrls.length === 0) {
    throw new Error('No valid HTTP or HTTPS URLs provided. Please ensure URLs have valid format (e.g. https://example.com).');
  }

  const urlItems: BatchItem[] = [];
  let serviceAccountIndex = 0;

  // 2. Process URLs in bounded concurrent chunks (chunk size: 10)
  const chunkSize = 10;
  for (let c = 0; c < cleanUrls.length; c += chunkSize) {
    const chunk = cleanUrls.slice(c, c + chunkSize);
    const chunkPromises = chunk.map(async (targetUrl) => {
      const category = detectUrlCategory(targetUrl);
      const trackingId = 'trk_' + Math.random().toString(36).substring(2, 10);
      const itemStartTime = Date.now();

      // Technical analysis (SSRF-safe DNS, HTTP status, robots.txt, canonical, meta robots)
      let analysis: TechnicalAnalysis | undefined;
      if (!options.skipAnalysis) {
        try {
          analysis = await analyzeUrl(targetUrl);
        } catch (analysisErr: any) {
          console.warn(`[ANALYSIS_WARN] Error analyzing ${targetUrl}:`, analysisErr.message);
        }
      }

      // Google Indexing API (Real Service Account only — never fake simulation)
      let googleApiResult: any = null;
      if (activeServiceAccounts.length > 0) {
        const sa = activeServiceAccounts[serviceAccountIndex++ % activeServiceAccounts.length];
        const googleAdapter = new GoogleIndexingApiAdapter();
        const submitRes = await googleAdapter.submit([targetUrl], { serviceAccount: sa });
        googleApiResult = {
          account: sa.client_email,
          success: submitRes.success,
          statusCode: submitRes.statusCode || (submitRes.success ? 200 : 400),
          notifyTime: new Date().toISOString(),
          message: submitRes.message,
          error: submitRes.success ? null : submitRes.message,
        };
      } else {
        googleApiResult = {
          configured: false,
          account: 'None',
          success: false,
          note: 'No Google Cloud Service Account configured. Upload JSON credentials in Settings to enable Google Indexing API for eligible JobPosting/BroadcastEvent pages.',
        };
      }

      // OmegaIndexer Adapter (if API key is present in credentials)
      let providerDispatches: any[] = [];
      const omegaApiKey = creds.apiKey || creds.omegaApiKey;
      if (omegaApiKey) {
        const omegaAdapter = new OmegaIndexerAdapter();
        const omegaRes = await omegaAdapter.submit([targetUrl], { apiKey: omegaApiKey });
        providerDispatches.push(omegaRes);
      }

      const itemLatency = Date.now() - itemStartTime;

      // Determine truthful per-URL status
      let displayStatus = 'Queued for Crawl Discovery';
      if (analysis) {
        if (analysis.verdict === 'ssrf_blocked') {
          displayStatus = 'Prohibited (SSRF Blocked)';
        } else if (analysis.verdict === 'blocked_noindex') {
          displayStatus = 'Blocked (Meta Noindex)';
        } else if (analysis.verdict === 'blocked_robots') {
          displayStatus = 'Blocked (Robots.txt)';
        } else if (analysis.verdict === 'client_error') {
          displayStatus = `HTTP ${analysis.statusCode} Client Error`;
        } else if (analysis.verdict === 'server_error') {
          displayStatus = `HTTP ${analysis.statusCode} Server Error`;
        } else if (analysis.verdict === 'unreachable') {
          displayStatus = 'Unreachable Destination';
        } else if (analysis.isIndexable) {
          displayStatus = 'Technically Indexable';
        }
      }

      return {
        url: targetUrl,
        trackingId: trackingId,
        category: category,
        status: displayStatus,
        indexStatus: 'Unverified', // Never falsely claim 'Indexed' without verified Search Console confirmation
        technicalAnalysis: analysis,
        googleApi: googleApiResult,
        providerDispatches: providerDispatches,
        tierResults: [],
        responseLatency: itemLatency,
        submittedAt: new Date().toISOString(),
      };
    });

    const chunkResults = await Promise.all(chunkPromises);
    urlItems.push(...chunkResults);
  }

  // 3. Trigger WebSub broadcast for the updated syndication feed
  const feedUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://indexmetrixx.vercel.app'}/feed.xml`;
  pingWebSubHub(feedUrl).catch(() => {});

  const acceptedCount = urlItems.filter(i => i.status !== 'Prohibited (SSRF Blocked)' && i.status !== 'Unreachable Destination').length;

  const batchRecord: BatchRecord = {
    batchId: batchId,
    totalUrls: urlItems.length,
    status: 'Processed',
    accepted: acceptedCount,
    successRate: `${Math.round((acceptedCount / urlItems.length) * 100)}%`,
    processingTimeMs: Date.now() - startTime,
    createdAt: new Date().toISOString(),
    mode: mode,
    serviceAccountsUsed: activeServiceAccounts.length,
    isLiveGoogleApi: activeServiceAccounts.length > 0,
    items: urlItems,
  };

  // 4. Authoritative persistence in Vercel Blob store & fallback
  const batches = await getBatches();
  batches.unshift(batchRecord);
  await saveBatches(batches);

  return batchRecord;
}
