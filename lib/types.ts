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
  status: string;
  indexStatus: string;
  googleApi: any;
  tierResults: any[];
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
  serviceAccountsUsed: number;
  isLiveGoogleApi: boolean;
  items: BatchItem[];
}
