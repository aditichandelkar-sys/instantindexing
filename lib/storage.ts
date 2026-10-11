import fs from 'fs';
import path from 'path';
import os from 'os';
import { put, head } from '@vercel/blob';
import { BatchRecord } from './types';

// In serverless environments (Vercel), write to os.tmpdir()
const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'data')
  : path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {}
}

const BATCHES_FILE = path.join(DATA_DIR, 'batches.json');
const CREDENTIALS_FILE = path.join(DATA_DIR, 'credentials.json');
const GSC_AUTH_FILE = path.join(DATA_DIR, 'gsc_auth.json');

// Root repository seed files (bundled in deployment)
const SEED_BATCHES_FILE = path.join(process.cwd(), 'data', 'batches.json');
const SEED_CREDENTIALS_FILE = path.join(process.cwd(), 'data', 'credentials.json');

// Memory cache
let memoryBatches: BatchRecord[] | null = null;
let memoryCredentials: any = null;
let memoryGscAuth: any = null;
let cachedBlobUrl: string | null = null;

const HAS_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

export function readJson<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data) as T;
    }
  } catch (err: any) {
    console.error(`[STORAGE] Error reading ${filePath}:`, err.message);
  }
  return defaultVal;
}

export function writeJson(filePath: string, data: any): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err: any) {
    console.error(`[STORAGE] Error writing ${filePath}:`, err.message);
  }
}

// Local batches loader with fallback to repository seed file
function getLocalBatches(): BatchRecord[] {
  if (memoryBatches !== null) return memoryBatches;
  if (fs.existsSync(BATCHES_FILE)) {
    const loaded = readJson<BatchRecord[]>(BATCHES_FILE, []);
    if (loaded && loaded.length > 0) {
      memoryBatches = loaded;
      return loaded;
    }
  }
  if (fs.existsSync(SEED_BATCHES_FILE)) {
    const loaded = readJson<BatchRecord[]>(SEED_BATCHES_FILE, []);
    memoryBatches = loaded;
    return loaded;
  }
  memoryBatches = [];
  return [];
}

// Synchronous batches getter (fallback)
export function getBatchesSync(): BatchRecord[] {
  return getLocalBatches();
}

// Authoritative Batches Storage (Async with Vercel Blob support)
export async function getBatches(): Promise<BatchRecord[]> {
  if (HAS_BLOB) {
    try {
      let blobUrl = cachedBlobUrl;
      if (!blobUrl) {
        try {
          const info = await head('data/batches.json');
          blobUrl = info.url;
          cachedBlobUrl = blobUrl;
        } catch (headErr: any) {
          // If blob does not exist yet, seed it with local/bundled records
          const seed = getLocalBatches();
          const created = await put('data/batches.json', JSON.stringify(seed, null, 2), {
            access: 'public',
            addRandomSuffix: false,
            allowOverwrite: true,
          });
          blobUrl = created.url;
          cachedBlobUrl = blobUrl;
          memoryBatches = seed;
          return seed;
        }
      }

      if (blobUrl) {
        const res = await fetch(blobUrl, { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as BatchRecord[];
          if (Array.isArray(data)) {
            memoryBatches = data;
            return data;
          }
        }
      }
    } catch (err: any) {
      console.error('[STORAGE] Error fetching batches from Blob, falling back to local:', err.message);
    }
  }

  return getLocalBatches();
}

export async function saveBatches(batches: BatchRecord[]): Promise<void> {
  const capped = batches.slice(0, 100);
  memoryBatches = capped;
  writeJson(BATCHES_FILE, capped);

  if (HAS_BLOB) {
    try {
      const blob = await put('data/batches.json', JSON.stringify(capped, null, 2), {
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      cachedBlobUrl = blob.url;
    } catch (err: any) {
      console.error('[STORAGE] Error saving batches to Blob:', err.message);
      throw new Error(`Failed to save batches to storage: ${err.message}`);
    }
  }
}

// Credentials Storage
export function getCredentials(): any {
  if (memoryCredentials !== null) return memoryCredentials;
  if (fs.existsSync(CREDENTIALS_FILE)) {
    const loaded = readJson(CREDENTIALS_FILE, null);
    if (loaded) {
      memoryCredentials = loaded;
      return loaded;
    }
  }
  if (fs.existsSync(SEED_CREDENTIALS_FILE)) {
    const loaded = readJson(SEED_CREDENTIALS_FILE, null);
    if (loaded) {
      memoryCredentials = loaded;
      return loaded;
    }
  }
  const defaultVal = {
    serviceAccounts: [],
    apiKey: '',
    settings: {
      useGoogleApi: true,
      useIndexNow: true,
      useRpcPing: true,
      useCrawlHub: true,
      simulationModeIfNoKeys: true,
    },
  };
  memoryCredentials = defaultVal;
  return defaultVal;
}

export function saveCredentials(data: any): void {
  memoryCredentials = data;
  writeJson(CREDENTIALS_FILE, data);
}

// GSC Auth File Storage (Backup)
export function getGscAuthFile(): any {
  if (memoryGscAuth !== null) return memoryGscAuth;
  const loaded = readJson(GSC_AUTH_FILE, null);
  memoryGscAuth = loaded;
  return loaded;
}

export function saveGscAuthFile(data: any): void {
  memoryGscAuth = data;
  writeJson(GSC_AUTH_FILE, data);
}

export function clearGscAuthFile(): void {
  memoryGscAuth = null;
  if (fs.existsSync(GSC_AUTH_FILE)) {
    try {
      fs.unlinkSync(GSC_AUTH_FILE);
    } catch (e) {}
  }
}
