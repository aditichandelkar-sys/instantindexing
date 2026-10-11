import { TechnicalAnalysis } from './url-analyzer';

export interface GscUser {
  email: string;
  name?: string;
  picture?: string;
}

export interface GscTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date: number;
  token_type?: string;
  scope?: string;
}

export interface GscAuthSession {
  connectedAt: string;
  tokens: GscTokens;
  user: GscUser;
}

export interface GscSiteEntry {
  siteUrl: string;
  permissionLevel: string;
}

export interface GscInspectionResult {
  url: string;
  siteUrl: string;
  verdict: string;
  coverageState: string;
  robotsTxtState: string;
  indexingState: string;
  lastCrawlTime: string;
  pageFetchState: string;
  googleCanonical: string;
  userCanonical: string;
  indexStatus: 'Indexed' | 'Not Indexed' | 'Failed';
  inspectedAt: string;
  rawInspection?: any;
  error?: string;
}

export interface GscSitemapEntry {
  path: string;
  lastSubmitted?: string;
  lastDownloaded?: string;
  errors?: number;
  contents?: Array<{
    type?: string;
    submitted?: string | number;
    indexed?: string | number;
  }>;
}

export interface BatchItem {
  url: string;
  trackingId: string;
  category: {
    type: string;
    label: string;
    icon: string;
    color: string;
  };
  status: string; // 'Queued for Discovery', 'Technically Indexable', 'Blocked (noindex/robots)', 'Failed'
  indexStatus: string; // 'Unverified', 'Indexed' (only if confirmed by GSC or real verified source)
  technicalAnalysis?: TechnicalAnalysis;
  googleApi?: any;
  tierResults?: any[];
  providerDispatches?: any[];
  responseLatency: number;
  submittedAt: string;
}

export interface BatchRecord {
  batchId: string;
  totalUrls: number;
  status: string;
  accepted: number;
  successRate: string;
  processingTimeMs: number;
  createdAt: string;
  mode?: 'third_party' | 'gsc_property';
  serviceAccountsUsed: number;
  isLiveGoogleApi: boolean;
  items: BatchItem[];
}
