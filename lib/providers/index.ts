import https from 'https';
import { getGoogleAccessToken, publishToGoogleIndexingApi } from '../indexing-engine-helpers';

export interface ProviderSubmitResult {
  providerId: string;
  providerName: string;
  success: boolean;
  statusCode?: number;
  jobId?: string;
  message: string;
  details?: any;
  latencyMs: number;
}

export interface ProviderAdapter {
  id: string;
  name: string;
  isConfigured(config?: any): boolean;
  submit(urls: string[], config?: any): Promise<ProviderSubmitResult>;
}

// 1. Google WebSub Syndication Feed Pinger (Officially supported W3C / Google pubsubhubbub protocol)
export async function pingWebSubHub(feedUrl: string): Promise<ProviderSubmitResult> {
  const startTime = Date.now();
  const hubUrl = 'https://pubsubhubbub.appspot.com/publish';
  const postData = `hub.mode=publish&hub.url=${encodeURIComponent(feedUrl)}`;

  return new Promise((resolve) => {
    const req = https.request(hubUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'IndexMetrix-Syndicator/1.0',
      },
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const isSuccess = res.statusCode === 204 || (res.statusCode && res.statusCode >= 200 && res.statusCode < 300);
        resolve({
          providerId: 'websub',
          providerName: 'Google WebSub Hub',
          success: isSuccess,
          statusCode: res.statusCode,
          message: isSuccess
            ? 'WebSub hub successfully notified of updated discovery feed.'
            : `WebSub hub returned HTTP ${res.statusCode}`,
          latencyMs: Date.now() - startTime,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        providerId: 'websub',
        providerName: 'Google WebSub Hub',
        success: false,
        message: `WebSub notification error: ${err.message}`,
        latencyMs: Date.now() - startTime,
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        providerId: 'websub',
        providerName: 'Google WebSub Hub',
        success: false,
        message: 'WebSub hub request timed out',
        latencyMs: Date.now() - startTime,
      });
    });

    req.write(postData);
    req.end();
  });
}

// 2. Google Indexing API Adapter (Strictly requires valid Service Account)
export class GoogleIndexingApiAdapter implements ProviderAdapter {
  id = 'google_indexing_api';
  name = 'Google Cloud Indexing API';

  isConfigured(config?: any): boolean {
    const sa = config?.serviceAccount;
    return !!(sa && sa.client_email && sa.private_key);
  }

  async submit(urls: string[], config?: any): Promise<ProviderSubmitResult> {
    const startTime = Date.now();
    const sa = config?.serviceAccount;

    if (!this.isConfigured(config)) {
      return {
        providerId: this.id,
        providerName: this.name,
        success: false,
        message: 'No Google Cloud Service Account configured. To use Google Indexing API, provide a Service Account JSON.',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      // Test token first
      await getGoogleAccessToken(sa);
      const results: any[] = [];
      let successCount = 0;

      // Submit URLs sequentially or in small chunks with timeout
      for (const url of urls.slice(0, 50)) {
        const res: any = await publishToGoogleIndexingApi(url, sa, 'URL_UPDATED');
        results.push({ url, res });
        if (res.success) successCount++;
      }

      const allSuccess = successCount === urls.length;
      return {
        providerId: this.id,
        providerName: this.name,
        success: allSuccess,
        statusCode: allSuccess ? 200 : 207,
        message: `Dispatched ${successCount}/${urls.length} URLs to Google Indexing API. (Eligibility note: Google officially restricts API indexing to JobPosting and BroadcastEvent metadata).`,
        details: results,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        providerId: this.id,
        providerName: this.name,
        success: false,
        message: `Google Indexing API error: ${err.message}`,
        latencyMs: Date.now() - startTime,
      };
    }
  }
}

// 3. OmegaIndexer Official REST API Adapter
export class OmegaIndexerAdapter implements ProviderAdapter {
  id = 'omegaindexer';
  name = 'OmegaIndexer API';

  isConfigured(config?: any): boolean {
    return !!(config?.apiKey && config.apiKey.trim().length > 5);
  }

  async submit(urls: string[], config?: any): Promise<ProviderSubmitResult> {
    const startTime = Date.now();
    const apiKey = config?.apiKey?.trim();

    if (!apiKey) {
      return {
        providerId: this.id,
        providerName: this.name,
        success: false,
        message: 'OmegaIndexer API key not configured. Enter your API key in Settings.',
        latencyMs: Date.now() - startTime,
      };
    }

    const payload = JSON.stringify({
      api_key: apiKey,
      urls: urls,
      drip_feed: config?.dripFeedDays || 1,
    });

    return new Promise((resolve) => {
      const req = https.request('https://www.omegaindexer.com/api/campaign/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 8000,
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const isOk = res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && (parsed.status === 'success' || parsed.success);
            resolve({
              providerId: 'omegaindexer',
              providerName: 'OmegaIndexer API',
              success: isOk,
              statusCode: res.statusCode,
              jobId: parsed.campaign_id || parsed.id || undefined,
              message: isOk ? `OmegaIndexer campaign created: ${parsed.message || 'Queued'}` : (parsed.error || parsed.message || `HTTP ${res.statusCode}`),
              details: parsed,
              latencyMs: Date.now() - startTime,
            });
          } catch {
            resolve({
              providerId: 'omegaindexer',
              providerName: 'OmegaIndexer API',
              success: false,
              statusCode: res.statusCode,
              message: `Failed to parse response: ${body.substring(0, 100)}`,
              latencyMs: Date.now() - startTime,
            });
          }
        });
      });

      req.on('error', (err) => {
        resolve({
          providerId: 'omegaindexer',
          providerName: 'OmegaIndexer API',
          success: false,
          message: `OmegaIndexer connection error: ${err.message}`,
          latencyMs: Date.now() - startTime,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          providerId: 'omegaindexer',
          providerName: 'OmegaIndexer API',
          success: false,
          message: 'OmegaIndexer request timed out',
          latencyMs: Date.now() - startTime,
        });
      });

      req.write(payload);
      req.end();
    });
  }
}
