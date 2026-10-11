import fs from 'fs';
import path from 'path';
import os from 'os';
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

// Memory cache to maintain state across hot lambda invocations
let memoryBatches: BatchRecord[] | null = null;
let memoryCredentials: any = null;
let memoryGscAuth: any = null;

export function readJson<T>(filePath: string, defaultVal: T): T {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data) as T;
    }
  } catch (err: any) {
    console.error(`Error reading ${filePath}:`, err.message);
  }
  return defaultVal;
}

export function writeJson(filePath: string, data: any): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err: any) {
    console.error(`Error writing ${filePath}:`, err.message);
  }
}

// Batches Storage
export function getBatches(): BatchRecord[] {
  if (memoryBatches !== null) return memoryBatches;
  const loaded = readJson<BatchRecord[]>(BATCHES_FILE, []);
  memoryBatches = loaded;
  return loaded;
}

export function saveBatches(batches: BatchRecord[]): void {
  memoryBatches = batches.slice(0, 100);
  writeJson(BATCHES_FILE, memoryBatches);
}

// Credentials Storage
export function getCredentials(): any {
  if (memoryCredentials !== null) return memoryCredentials;
  const loaded = readJson(CREDENTIALS_FILE, {
    serviceAccounts: [],
    apiKey: '',
    settings: {
      useGoogleApi: true,
      useIndexNow: true,
      useRpcPing: true,
      useCrawlHub: true,
      simulationModeIfNoKeys: true
    }
  });
  memoryCredentials = loaded;
  return loaded;
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
