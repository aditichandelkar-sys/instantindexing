import crypto from 'crypto';
import https from 'https';

export function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

const saTokenCache: { [email: string]: { token: string; expiry: number } } = {};

export async function getGoogleAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const { client_email, private_key } = serviceAccount;
  if (!client_email || !private_key) {
    throw new Error('Invalid Service Account: client_email or private_key missing');
  }

  const cached = saTokenCache[client_email];
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.expiry > now + 300) {
    return cached.token;
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: client_email,
    scope: 'https://www.googleapis.com/auth/indexing',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signatureInput);
  const signature = signer.sign(private_key, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const jwt = `${signatureInput}.${signature}`;

  const tokenData: any = await new Promise((resolve, reject) => {
    const postData = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 8000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300 && parsed.access_token) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error_description || parsed.error || `HTTP ${res.statusCode}`));
          }
        } catch {
          reject(new Error('Failed to parse Google OAuth response'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Google OAuth token request timed out')); });
    req.write(postData);
    req.end();
  });

  saTokenCache[client_email] = {
    token: tokenData.access_token,
    expiry: now + (tokenData.expires_in || 3600),
  };

  return tokenData.access_token;
}

export async function publishToGoogleIndexingApi(url: string, serviceAccount: any, type: string = 'URL_UPDATED'): Promise<any> {
  const accessToken = await getGoogleAccessToken(serviceAccount);
  const payload = JSON.stringify({ url: url, type: type });

  return new Promise((resolve) => {
    const req = https.request('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 8000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              statusCode: res.statusCode,
              data: parsed,
              notifyTime: parsed.urlNotificationMetadata?.latestUpdate?.notifyTime || new Date().toISOString(),
            });
          } else {
            resolve({
              success: false,
              statusCode: res.statusCode,
              error: parsed.error?.message || `HTTP ${res.statusCode}`,
            });
          }
        } catch (e: any) {
          resolve({ success: false, statusCode: res.statusCode, error: e.message });
        }
      });
    });

    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Indexing API timeout' }); });
    req.write(payload);
    req.end();
  });
}
