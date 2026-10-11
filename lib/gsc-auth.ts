import crypto from 'crypto';
import https from 'https';
import { GscAuthSession, GscSiteEntry, GscInspectionResult, GscSitemapEntry } from './types';
import { getGscAuthFile, saveGscAuthFile, clearGscAuthFile } from './storage';

export const GSC_SCOPES = [
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/webmasters',
  'openid',
  'email',
  'profile'
].join(' ');

const COOKIE_NAME = 'gsc_session';

// Encryption key derived from APP_SECRET or GOOGLE_CLIENT_SECRET
function getEncryptionKey(): Buffer {
  const secret = process.env.APP_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'indexmetrix-fallback-secret-key-32';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSession(session: GscAuthSession): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const text = JSON.stringify(session);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSession(cookieValue: string): GscAuthSession | null {
  try {
    const parts = cookieValue.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, encryptedHex] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as GscAuthSession;
  } catch (err) {
    return null;
  }
}

export function getRedirectUri(): string {
  const envUri = (process.env.GOOGLE_REDIRECT_URI || '').trim();
  if (envUri) return envUri;
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/auth/google/callback`;
  }
  return 'https://indexmetrixx.vercel.app/auth/google/callback';
}

export function generateAuthUrl(customRedirectUri?: string): { url: string; state: string } {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  if (!clientId || clientId.includes('your-google-client-id')) {
    throw new Error('GOOGLE_CLIENT_ID is not configured in environment variables');
  }

  const state = crypto.randomBytes(16).toString('hex');
  const redirectUri = customRedirectUri || getRedirectUri();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GSC_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: state
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    state: state
  };
}

export async function exchangeCodeForTokens(code: string, customRedirectUri?: string): Promise<{ tokens: any; user: any }> {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
  const redirectUri = customRedirectUri || getRedirectUri();

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing');
  }

  const postData = new URLSearchParams({
    code: code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  }).toString();

  const tokenResponse: any = await new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && parsed.access_token) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error_description || parsed.error || body));
          }
        } catch (e) {
          reject(new Error('Failed to parse Google OAuth token response'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Google token exchange timed out')); });
    req.write(postData);
    req.end();
  });

  // Fetch user profile
  let userInfo: any = null;
  try {
    userInfo = await new Promise((resolve) => {
      const req = https.request('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenResponse.access_token}` }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(body)); } catch (e) { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.end();
    });
  } catch (e) {}

  return {
    tokens: tokenResponse,
    user: userInfo || { email: 'Connected Google Account' }
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();

  const postData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 8000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && parsed.access_token) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error_description || parsed.error || body));
          }
        } catch (e) {
          reject(new Error('Failed to parse token refresh response'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Token refresh timed out')); });
    req.write(postData);
    req.end();
  });
}

// Get valid token from session, refreshing if needed
export async function getValidAccessToken(session: GscAuthSession): Promise<{ token: string; updatedSession?: GscAuthSession }> {
  const now = Date.now();
  if (session.tokens.access_token && session.tokens.expiry_date > now + 180000) {
    return { token: session.tokens.access_token };
  }

  if (!session.tokens.refresh_token) {
    throw new Error('Session expired. Please reconnect Google Search Console.');
  }

  const refreshed = await refreshAccessToken(session.tokens.refresh_token);
  const updated: GscAuthSession = {
    ...session,
    tokens: {
      ...session.tokens,
      access_token: refreshed.access_token,
      expiry_date: Date.now() + ((refreshed.expires_in || 3600) * 1000)
    }
  };

  saveGscAuthFile(updated);
  return { token: refreshed.access_token, updatedSession: updated };
}

// Google Search Console API: List sites
export async function fetchSearchConsoleSites(accessToken: string): Promise<GscSiteEntry[]> {
  return new Promise((resolve, reject) => {
    const req = https.request('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed.siteEntry || []);
          } else {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Failed to parse Search Console sites response'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Google Search Console API: Inspect URL
export async function inspectUrl(accessToken: string, siteUrl: string, inspectionUrl: string): Promise<GscInspectionResult> {
  const payload = JSON.stringify({
    siteUrl: siteUrl,
    inspectionUrl: inspectionUrl,
    languageCode: 'en-US'
  });

  return new Promise((resolve) => {
    const req = https.request('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && parsed.inspectionResult) {
            const ir = parsed.inspectionResult;
            const indexResult = ir.indexStatusResult || {};
            const verdict = indexResult.verdict || 'VERDICT_UNSPECIFIED';
            const coverageState = indexResult.coverageState || 'Unknown coverage';
            const robotsTxtState = indexResult.robotsTxtState || 'ALLOWED';
            const indexingState = indexResult.indexingState || 'INDEXING_UNSPECIFIED';
            const lastCrawlTime = indexResult.lastCrawlTime || 'Not yet crawled';
            const pageFetchState = indexResult.pageFetchState || 'SUCCESSFUL';

            let indexStatus: 'Indexed' | 'Not Indexed' | 'Failed' = 'Not Indexed';
            if (verdict === 'PASS' || coverageState.toLowerCase().includes('indexed')) {
              indexStatus = 'Indexed';
            } else if (verdict === 'FAIL') {
              indexStatus = 'Not Indexed';
            }

            resolve({
              url: inspectionUrl,
              siteUrl: siteUrl,
              verdict: verdict,
              coverageState: coverageState,
              robotsTxtState: robotsTxtState,
              indexingState: indexingState,
              lastCrawlTime: lastCrawlTime,
              pageFetchState: pageFetchState,
              googleCanonical: indexResult.googleCanonical || 'Not determined',
              userCanonical: indexResult.userCanonical || 'Not declared',
              indexStatus: indexStatus,
              inspectedAt: new Date().toISOString(),
              rawInspection: ir
            });
          } else {
            resolve({
              url: inspectionUrl,
              siteUrl: siteUrl,
              verdict: 'FAIL',
              coverageState: parsed.error?.message || `HTTP ${res.statusCode}`,
              robotsTxtState: 'UNKNOWN',
              indexingState: 'FAILED',
              lastCrawlTime: 'N/A',
              pageFetchState: 'FAILED',
              googleCanonical: 'N/A',
              userCanonical: 'N/A',
              indexStatus: 'Failed',
              inspectedAt: new Date().toISOString(),
              error: parsed.error?.message || `API error (${res.statusCode})`
            });
          }
        } catch (e: any) {
          resolve({
            url: inspectionUrl,
            siteUrl: siteUrl,
            verdict: 'FAIL',
            coverageState: 'Response parse error',
            robotsTxtState: 'UNKNOWN',
            indexingState: 'FAILED',
            lastCrawlTime: 'N/A',
            pageFetchState: 'FAILED',
            googleCanonical: 'N/A',
            userCanonical: 'N/A',
            indexStatus: 'Failed',
            inspectedAt: new Date().toISOString(),
            error: e.message
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        url: inspectionUrl,
        siteUrl: siteUrl,
        verdict: 'FAIL',
        coverageState: 'Network error',
        robotsTxtState: 'UNKNOWN',
        indexingState: 'FAILED',
        lastCrawlTime: 'N/A',
        pageFetchState: 'FAILED',
        googleCanonical: 'N/A',
        userCanonical: 'N/A',
        indexStatus: 'Failed',
        inspectedAt: new Date().toISOString(),
        error: err.message
      });
    });

    req.write(payload);
    req.end();
  });
}

// Google Search Console API: List Sitemaps
export async function listSitemaps(accessToken: string, siteUrl: string): Promise<GscSitemapEntry[]> {
  return new Promise((resolve, reject) => {
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`;
    const req = https.request(endpoint, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed.sitemap || []);
          } else {
            reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error('Failed to parse sitemaps response'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Google Search Console API: Submit Sitemap
export async function submitSitemap(accessToken: string, siteUrl: string, feedpath: string): Promise<{ success: boolean; message?: string; error?: string }> {
  return new Promise((resolve) => {
    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(feedpath)}`;
    const req = https.request(endpoint, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, message: `Sitemap "${feedpath}" submitted to Google Search Console successfully!` });
        } else {
          resolve({ success: false, error: body || `HTTP ${res.statusCode}` });
        }
      });
    });
    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.end();
  });
}

// Revoke Token
export async function revokeToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    const req = https.request(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST'
    }, () => resolve());
    req.on('error', () => resolve());
    req.end();
  });
}

// Helper: Check if a URL belongs to a verified property
export function urlBelongsToProperty(testUrl: string, property: string): boolean {
  try {
    const parsed = new URL(testUrl);
    if (property.startsWith('sc-domain:')) {
      const domain = property.replace('sc-domain:', '').toLowerCase();
      const host = parsed.hostname.toLowerCase();
      return host === domain || host.endsWith('.' + domain);
    } else {
      return testUrl.toLowerCase().startsWith(property.toLowerCase());
    }
  } catch (e) {
    return false;
  }
}
