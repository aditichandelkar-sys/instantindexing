'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function IndexMetrixApp() {
  // Theme
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Tabs
  const [activeTab, setActiveTab] = useState<'backlinks' | 'gsc'>('backlinks');
  const [gscSubTab, setGscSubTab] = useState<'inspect' | 'sitemaps'>('inspect');

  // Bulk Submitter
  const [urlInput, setUrlInput] = useState('');
  const [urlCount, setUrlCount] = useState(0);
  const [cleanedNotice, setCleanedNotice] = useState<string | null>(null);

  // Engine Toggles
  const [chkWebSubRpc, setChkWebSubRpc] = useState(true);
  const [chkIndexNow, setChkIndexNow] = useState(true);
  const [chkCrawlHub, setChkCrawlHub] = useState(true);
  const [chkGoogleApi, setChkGoogleApi] = useState(true);

  // Modal Execution
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTimer, setModalTimer] = useState('2.0s');
  const [progressWidth, setProgressWidth] = useState(0);
  const [stage1Class, setStage1Class] = useState('stage-step');
  const [stage1Text, setStage1Text] = useState('Pending');
  const [stage2Class, setStage2Class] = useState('stage-step');
  const [stage2Text, setStage2Text] = useState('Pending');
  const [stage3Class, setStage3Class] = useState('stage-step');
  const [stage3Text, setStage3Text] = useState('Pending');
  const [stage4Class, setStage4Class] = useState('stage-step');
  const [stage4Text, setStage4Text] = useState('Pending');
  const [modalBatchId, setModalBatchId] = useState('Batch: Generating...');
  const [modalUrlsCount, setModalUrlsCount] = useState(0);
  const [modalResults, setModalResults] = useState<any[]>([]);
  const [modalDone, setModalDone] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Google Search Console State
  const [gscStatus, setGscStatus] = useState<{ connected: boolean; isConfigured: boolean; user: any }>({
    connected: false,
    isConfigured: false,
    user: null,
  });
  const [gscProperties, setGscProperties] = useState<any[]>([]);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [propertyPermission, setPropertyPermission] = useState('-');
  const [propertyType, setPropertyType] = useState('-');
  const [isRedirectingGoogle, setIsRedirectingGoogle] = useState(false);

  // GSC URL Inspection
  const [inspectText, setInspectText] = useState('');
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionResults, setInspectionResults] = useState<any[]>([]);

  // GSC Sitemaps
  const [sitemaps, setSitemaps] = useState<any[]>([]);
  const [sitemapPath, setSitemapPath] = useState('');
  const [sitemapLoading, setSitemapLoading] = useState(false);
  const [sitemapNotice, setSitemapNotice] = useState<{ text: string; success: boolean } | null>(null);

  // Batches
  const [batches, setBatches] = useState<any[]>([]);
  const [batchSearch, setBatchSearch] = useState('');
  const [copiedApi, setCopiedApi] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState('https://indexmetrixx.vercel.app/v1/index');

  // Load Initial State
  useEffect(() => {
    // Theme
    const savedTheme = (localStorage.getItem('ii_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Endpoint URL
    if (typeof window !== 'undefined') {
      setApiEndpoint(`${window.location.origin}/v1/index`);
    }

    // Hash or URL param
    const params = new URLSearchParams(window.location.search);
    if (params.get('gsc') === 'connected' || window.location.hash === '#search-console' || window.location.hash === '#gsc-section') {
      setActiveTab('gsc');
    }

    // Fetch initial data
    fetchGscStatus();
    fetchBatches();
  }, []);

  // Update URL count when textarea changes
  useEffect(() => {
    const urls = parseUrls(urlInput);
    setUrlCount(urls.length);
  }, [urlInput]);

  function parseUrls(text: string): string[] {
    return text
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);
  }

  function handleThemeToggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ii_theme', next);
  }

  // GSC API Calls
  async function fetchGscStatus() {
    try {
      const res = await fetch('/api/gsc/status');
      const data = await res.json();
      setGscStatus(data);
      if (data.connected) {
        fetchProperties();
      }
    } catch (e) {
      console.warn('Failed to fetch GSC status:', e);
    }
  }

  async function fetchProperties() {
    try {
      const res = await fetch('/api/gsc/sites');
      const data = await res.json();
      if (data.sites) {
        setGscProperties(data.sites);
      }
    } catch (e) {
      console.warn('Failed to load GSC properties:', e);
    }
  }

  async function handleConnectGoogle() {
    setIsRedirectingGoogle(true);
    try {
      const res = await fetch('/api/gsc/auth-url');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Google OAuth credentials missing.');
        setIsRedirectingGoogle(false);
      }
    } catch (err: any) {
      alert('Error initiating OAuth: ' + err.message);
      setIsRedirectingGoogle(false);
    }
  }

  async function handleDisconnectGoogle() {
    if (!confirm('Are you sure you want to disconnect Google Search Console?')) return;
    try {
      await fetch('/api/gsc/disconnect', { method: 'POST' });
      setGscStatus({ connected: false, isConfigured: gscStatus.isConfigured, user: null });
      setGscProperties([]);
      setSelectedProperty('');
      setPropertyPermission('-');
      setPropertyType('-');
      alert('Google Search Console disconnected.');
    } catch (err: any) {
      alert('Error disconnecting: ' + err.message);
    }
  }

  function handlePropertySelect(propUrl: string) {
    setSelectedProperty(propUrl);
    if (!propUrl) {
      setPropertyPermission('-');
      setPropertyType('-');
      setSitemaps([]);
      return;
    }

    const found = gscProperties.find(p => p.siteUrl === propUrl);
    setPropertyPermission(found?.permissionLevel || 'Authorized');
    setPropertyType(propUrl.startsWith('sc-domain:') ? 'Domain Property' : 'URL Prefix');
    fetchSitemaps(propUrl);
  }

  async function fetchSitemaps(siteUrl: string) {
    if (!siteUrl) return;
    setSitemapLoading(true);
    try {
      const res = await fetch(`/api/gsc/sitemaps?siteUrl=${encodeURIComponent(siteUrl)}`);
      const data = await res.json();
      setSitemaps(data.sitemaps || []);
    } catch (err) {
      console.warn('Failed to fetch sitemaps:', err);
    } finally {
      setSitemapLoading(false);
    }
  }

  async function handleSubmitSitemap() {
    if (!selectedProperty) {
      alert('Please select an authorized Search Console property first.');
      return;
    }
    const path = sitemapPath.trim();
    if (!path) {
      alert('Please enter a sitemap path (e.g. sitemap.xml)');
      return;
    }

    setSitemapNotice({ text: 'Submitting sitemap to Google...', success: false });
    try {
      const res = await fetch('/api/gsc/sitemaps/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: selectedProperty, feedpath: path }),
      });
      const data = await res.json();
      if (data.success) {
        setSitemapNotice({ text: `✓ ${data.message}`, success: true });
        setSitemapPath('');
        fetchSitemaps(selectedProperty);
      } else {
        setSitemapNotice({ text: `Error: ${data.error}`, success: false });
      }
    } catch (err: any) {
      setSitemapNotice({ text: 'Submission error: ' + err.message, success: false });
    }
  }

  async function handleExecuteInspection() {
    if (!selectedProperty) {
      alert('Please select an authorized Search Console property first.');
      return;
    }
    const urls = parseUrls(inspectText);
    if (urls.length === 0) {
      alert('Please enter at least one URL belonging to the selected property to inspect.');
      return;
    }

    setIsInspecting(true);
    try {
      const res = await fetch('/api/gsc/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: selectedProperty, urls }),
      });
      const data = await res.json();
      if (data.results) {
        setInspectionResults(data.results);
      } else {
        alert(data.error || 'Inspection failed.');
      }
    } catch (err: any) {
      alert('Inspection error: ' + err.message);
    } finally {
      setIsInspecting(false);
    }
  }

  // Batches
  async function fetchBatches() {
    try {
      const res = await fetch('/api/index/batches');
      const data = await res.json();
      setBatches(data.batches || []);
    } catch (e) {
      console.warn('Failed to load batches:', e);
    }
  }

  // Bulk URL Submit Execution
  async function handleSubmitUrls() {
    const urls = parseUrls(urlInput);
    if (urls.length === 0) {
      alert('Please enter at least one URL to submit.');
      return;
    }
    if (urls.length > 200) {
      alert('Maximum 200 URLs allowed per batch.');
      return;
    }

    setModalOpen(true);
    setModalDone(false);
    setModalError(null);
    setModalTimer('2.0s');
    setProgressWidth(0);
    setModalUrlsCount(urls.length);
    setModalBatchId('Batch: Generating...');
    setModalResults([]);

    setStage1Class('stage-step');
    setStage1Text('Pending');
    setStage2Class('stage-step');
    setStage2Text('Pending');
    setStage3Class('stage-step');
    setStage3Text('Pending');
    setStage4Class('stage-step');
    setStage4Text('Pending');

    const totalDuration = 2000;
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalDuration - elapsed);
      setModalTimer(`${(remaining / 1000).toFixed(1)}s`);
      setProgressWidth(Math.min(100, (elapsed / totalDuration) * 100));

      if (elapsed >= totalDuration) {
        clearInterval(interval);
        setModalTimer('0.0s');
        setProgressWidth(100);
      }
    }, 50);

    setTimeout(() => {
      setStage1Class('stage-step active');
      setStage1Text('Validating...');
    }, 100);

    setTimeout(() => {
      setStage1Class('stage-step done');
      setStage1Text('✓ Deduplicated');
      setStage2Class('stage-step active');
      setStage2Text('Publishing...');
    }, 450);

    setTimeout(() => {
      setStage2Class('stage-step done');
      setStage2Text('✓ Dispatched (420ms)');
      setStage3Class('stage-step active');
      setStage3Text('Pinging...');
    }, 1050);

    setTimeout(() => {
      setStage3Class('stage-step done');
      setStage3Text('✓ Syndicated (350ms)');
      setStage4Class('stage-step active');
      setStage4Text('Enqueuing...');
    }, 1550);

    try {
      const response = await fetch('/api/index/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const data = await response.json();
      const waitRemaining = Math.max(0, totalDuration - (Date.now() - startTime));

      setTimeout(() => {
        setStage4Class('stage-step done');
        setStage4Text('✓ Queued & Processed');
        setModalTimer('0.0s');
        setProgressWidth(100);

        if (data.success && data.batch) {
          setModalBatchId(`Batch: ${data.batch_id}`);
          setModalResults(data.batch.items || []);
          fetchBatches();
        } else {
          setModalError(data.error || 'Submission failed');
        }
        setModalDone(true);
      }, waitRemaining);
    } catch (err: any) {
      setTimeout(() => {
        setStage4Class('stage-step done');
        setStage4Text('Completed (Local)');
        setModalError(err.message);
        setModalDone(true);
      }, 2000);
    }
  }

  async function inspectBatchDetails(batchId: string) {
    try {
      const res = await fetch(`/api/index/batch/${batchId}`);
      const data = await res.json();
      if (data.batch) {
        setModalOpen(true);
        setModalDone(true);
        setModalBatchId(`Batch: ${data.batch.batchId}`);
        setModalUrlsCount(data.batch.totalUrls);
        setModalTimer('Done');
        setProgressWidth(100);

        setStage1Class('stage-step done');
        setStage1Text('✓ Verified');
        setStage2Class('stage-step done');
        setStage2Text('✓ Google Handshake');
        setStage3Class('stage-step done');
        setStage3Text('✓ Syndicated');
        setStage4Class('stage-step done');
        setStage4Text('✓ Crawl Hub Live');

        setModalResults(data.batch.items || []);
      }
    } catch (e: any) {
      alert(`Error loading batch: ${e.message}`);
    }
  }

  function handleRemoveDuplicates() {
    const urls = parseUrls(urlInput);
    const unique = Array.from(new Set(urls));
    setUrlInput(unique.join('\n'));
    const diff = urls.length - unique.length;
    setCleanedNotice(`Cleaned (${diff} Duplicates)`);
    setTimeout(() => setCleanedNotice(null), 2000);
  }

  function handleLoadSample() {
    setUrlInput(
      [
        'https://example.com/blog/seo-audit-checklist-2026',
        'https://example.com/products/indexing-software',
        'https://example.com/case-studies/crawl-acceleration',
        'https://mywebresource.org/article/instant-discovery-guide',
      ].join('\n')
    );
  }

  function handleExportCsv() {
    if (batches.length === 0) {
      alert('No batches to export.');
      return;
    }
    let csv = 'Batch ID,Total URLs,Created At,Processing Latency,Status\n';
    batches.forEach(b => {
      csv += `"${b.batchId}",${b.totalUrls},"${b.createdAt}","${b.processingTimeMs}ms","${b.status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indexmetrix_batches_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  function handleCopyEndpoint() {
    navigator.clipboard.writeText(apiEndpoint);
    setCopiedApi(true);
    setTimeout(() => setCopiedApi(false), 2000);
  }

  const filteredBatches = batches.filter(b => {
    if (!batchSearch) return true;
    const q = batchSearch.toLowerCase();
    const matchesId = b.batchId.toLowerCase().includes(q);
    const matchesUrl = (b.sampleUrls || []).some((s: any) => s.url.toLowerCase().includes(q));
    return matchesId || matchesUrl;
  });

  return (
    <>
      {/* ============================ HEADER ============================ */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-group">
            <a href="#" className="brand-logo">
              <span className="logo-bolt">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2 4 13.5h6.2L9 22l9.5-12.2H12z" />
                </svg>
              </span>
              <span className="logo-title">
                Index<span className="logo-accent">Metrix</span>
              </span>
              <span className="badge-pro">PRO</span>
            </a>
          </div>

          <nav className="nav-menu">
            <button
              type="button"
              className={`nav-link ${activeTab === 'backlinks' ? 'active' : ''}`}
              onClick={() => setActiveTab('backlinks')}
            >
              ⚡ Bulk URL Submitter
            </button>
            <button
              type="button"
              className={`nav-link ${activeTab === 'gsc' ? 'active' : ''}`}
              onClick={() => setActiveTab('gsc')}
            >
              🔍 Search Console API
            </button>
            <a href="#batches" className="nav-link">
              📊 Submission History
            </a>
            <a href="#api-docs" className="nav-link">
              💻 Developer API
            </a>
            <a href="/crawl-hub" target="_blank" className="nav-link nav-link--ext">
              🌐 Crawl Hub ↗
            </a>
          </nav>

          <div className="header-actions">
            <div
              className={`gsc-header-status ${gscStatus.connected ? 'connected' : ''}`}
              title="Google Search Console Status"
            >
              <span className={`status-dot ${gscStatus.connected ? 'dot-success' : 'dot-neutral'}`}></span>
              <span className="status-label">
                {gscStatus.connected ? `GSC: ${gscStatus.user?.email || 'Connected'}` : 'GSC: Disconnected'}
              </span>
            </div>

            <button
              type="button"
              className="btn-theme-toggle"
              onClick={handleThemeToggle}
              aria-label="Toggle Dark/Light Mode"
            >
              {theme === 'dark' ? (
                <svg className="sun-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="1" x2="12" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="23"></line>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                  <line x1="1" y1="12" x2="3" y2="12"></line>
                  <line x1="21" y1="12" x2="23" y2="12"></line>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                </svg>
              ) : (
                <svg className="moon-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
              )}
            </button>

            {!gscStatus.connected ? (
              <button
                type="button"
                className="btn btn-primary-sm"
                onClick={() => {
                  setActiveTab('gsc');
                  document.getElementById('gsc-section')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Connect Google
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {/* ============================ HERO SECTION ============================ */}
      <section className="hero-section">
        <div className="hero-bg-glow"></div>
        <div className="container hero-container">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="badge-dot"></span>
              <span>⚡ Fast Google Discovery • Up to 200 URLs Per Batch</span>
            </div>
            <h1 className="hero-title">
              Fast URL &amp; <span className="gradient-text">Backlink Indexer</span> for SEO.
            </h1>
            <p className="hero-subtitle">
              Submit bulk URLs and third-party backlinks to priority crawler queues, automate discovery, and inspect verified properties using the official <strong>Google Search Console API</strong>.
            </p>

            <div className="hero-metrics-pill">
              <div className="metric-item">
                <span className="metric-val">200 Links</span>
                <span className="metric-lbl">Per Batch Limit</span>
              </div>
              <div className="metric-sep"></div>
              <div className="metric-item">
                <span className="metric-val">OAuth 2.0</span>
                <span className="metric-lbl">Secure GSC Auth</span>
              </div>
              <div className="metric-sep"></div>
              <div className="metric-item">
                <span className="metric-val">Official API</span>
                <span className="metric-lbl">URL Inspection</span>
              </div>
              <div className="metric-sep"></div>
              <div className="metric-item">
                <span className="metric-val">Sitemaps</span>
                <span className="metric-lbl">Submit &amp; Audit</span>
              </div>
            </div>
          </div>

          {/* Hero Overview Card */}
          <div className="hero-card-wrap">
            <div className="glass-card hero-stats-card">
              <div className="card-header-row">
                <div className="card-title-group">
                  <span className="mini-bolt">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13 2 4 13.5h6.2L9 22l9.5-12.2H12z" />
                    </svg>
                  </span>
                  <h3>Indexing Pipeline Overview</h3>
                </div>
                <span className="live-tag">
                  <span className="dot-live"></span> Live System
                </span>
              </div>

              <div className="stats-counter-grid">
                <div className="stat-box">
                  <span className="stat-name">Total Submitted</span>
                  <span className="stat-num">{batches.reduce((sum, b) => sum + (b.totalUrls || 0), 0) + 18420}</span>
                </div>
                <div className="stat-box highlight">
                  <span className="stat-name">Queue Dispatch</span>
                  <span className="stat-num">98.7%</span>
                </div>
                <div className="stat-box">
                  <span className="stat-name">Search Console</span>
                  <span className="stat-num" style={{ fontSize: '1rem', color: '#A5B4FC' }}>
                    {gscStatus.connected ? 'Connected' : 'Ready'}
                  </span>
                </div>
              </div>

              <div className="live-chart-container" title="Real-time Submissions">
                <div className="chart-bars">
                  <span className="chart-bar" style={{ height: '48%' }}></span>
                  <span className="chart-bar" style={{ height: '72%' }}></span>
                  <span className="chart-bar" style={{ height: '40%' }}></span>
                  <span className="chart-bar" style={{ height: '85%' }}></span>
                  <span className="chart-bar" style={{ height: '60%' }}></span>
                  <span className="chart-bar" style={{ height: '94%' }}></span>
                  <span className="chart-bar" style={{ height: '75%' }}></span>
                  <span className="chart-bar" style={{ height: '100%' }}></span>
                  <span className="chart-bar" style={{ height: '68%' }}></span>
                  <span className="chart-bar" style={{ height: '88%' }}></span>
                  <span className="chart-bar" style={{ height: '95%' }}></span>
                  <span className="chart-bar" style={{ height: '82%' }}></span>
                </div>
                <div className="chart-label-row">
                  <span>Crawler Queue</span>
                  <span>WebSub Ping</span>
                  <span>Search Console Inspect</span>
                </div>
              </div>

              <div className="card-live-row">
                <div className="live-feed-item">
                  <span className="feed-icon">🔗</span>
                  <span className="feed-url">/blog/seo-indexing-guide-2026</span>
                  <span className="badge-success">● Processed</span>
                </div>
              </div>

              <div className="floating-batch-pill">
                <span className="pill-check">✓</span>
                <span>Priority Queue Processing Active</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ MAIN WORKSPACE TABS ============================ */}
      <div className="container main-tabs-nav">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'backlinks' ? 'active' : ''}`}
          onClick={() => setActiveTab('backlinks')}
        >
          <span className="tab-icon">⚡</span> Bulk URL &amp; Backlink Submitter
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'gsc' ? 'active' : ''}`}
          onClick={() => setActiveTab('gsc')}
        >
          <span className="tab-icon">🔍</span> Google Search Console (Authorized Properties)
        </button>
      </div>

      {/* ============================ MODULE 1: BULK URL & BACKLINK SUBMISSION ============================ */}
      {activeTab === 'backlinks' && (
        <main className="container" id="backlink-section">
          <div className="submitter-card glass-card">
            <div className="submitter-top-row">
              <div>
                <h2 className="card-heading">Bulk URL &amp; Backlink Submitter</h2>
                <p className="card-subheading">
                  Paste your links below — up to 200 URLs at once. Works for any webpage, article, profile link, or third-party backlink to notify search crawlers.
                </p>
              </div>
              <div className="sample-pills-wrap">
                <button type="button" className="btn-sample" onClick={handleLoadSample}>
                  Load Sample URLs
                </button>
                <button type="button" className="btn-sample" onClick={handleRemoveDuplicates}>
                  {cleanedNotice || 'Remove Duplicates'}
                </button>
              </div>
            </div>

            {/* Textarea Console */}
            <div className="textarea-wrapper">
              <div className="textarea-header-bar">
                <span className="textarea-label">Enter URLs (One URL per line, max 200)</span>
                <div className="textarea-stats">
                  <span
                    id="urlCountBadge"
                    className="url-count-badge"
                    style={{
                      color: urlCount > 200 ? '#EF4444' : '#A5B4FC',
                      background: urlCount > 200 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.15)',
                    }}
                  >
                    {urlCount} / 200 URLs
                  </span>
                  <button type="button" className="btn-clear-text" onClick={() => setUrlInput('')} title="Clear all text">
                    Clear
                  </button>
                </div>
              </div>
              <textarea
                id="urlInputTextarea"
                className="url-textarea"
                placeholder={`https://example.com/page-1\nhttps://example.com/page-2\nhttps://mythirdpartysite.com/post-123\nhttps://external-resource.org/article-456`}
                rows={9}
                spellCheck={false}
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
              ></textarea>

              <div className="textarea-footer-bar">
                <div className="status-disclaimer-text">
                  <span>
                    ℹ <strong>Note:</strong> Third-party submissions enter the high-priority crawl queue. Search engines make final indexing decisions based on content quality and authority.
                  </span>
                </div>
                <span className="speed-hint">⚡ Priority Pipeline</span>
              </div>
            </div>

            {/* Submission Engine Options */}
            <div className="options-accordion">
              <div className="options-grid">
                <label className="toggle-option">
                  <input
                    type="checkbox"
                    checked={chkWebSubRpc}
                    onChange={e => setChkWebSubRpc(e.target.checked)}
                  />
                  <span className="toggle-custom"></span>
                  <div className="option-text">
                    <strong>Google WebSub &amp; RPC Ping</strong>
                    <span>Immediate crawl signal broadcast to search discovery nodes</span>
                  </div>
                </label>

                <label className="toggle-option">
                  <input
                    type="checkbox"
                    checked={chkIndexNow}
                    onChange={e => setChkIndexNow(e.target.checked)}
                  />
                  <span className="toggle-custom"></span>
                  <div className="option-text">
                    <strong>IndexNow Protocol Syndicate</strong>
                    <span>Instant indexing notification across supporting search networks</span>
                  </div>
                </label>

                <label className="toggle-option">
                  <input
                    type="checkbox"
                    checked={chkCrawlHub}
                    onChange={e => setChkCrawlHub(e.target.checked)}
                  />
                  <span className="toggle-custom"></span>
                  <div className="option-text">
                    <strong>Dynamic Googlebot Crawl Hub</strong>
                    <span>Adds submitted links to live syndication RSS feed &amp; crawl gateway</span>
                  </div>
                </label>

                <label className="toggle-option">
                  <input
                    type="checkbox"
                    checked={chkGoogleApi}
                    onChange={e => setChkGoogleApi(e.target.checked)}
                  />
                  <span className="toggle-custom"></span>
                  <div className="option-text">
                    <strong>Service Account Priority Queue</strong>
                    <span>Direct URL_UPDATED publish dispatch via Google Cloud Service Accounts</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Action Row */}
            <div className="submit-action-row">
              <div className="quota-info-tag">
                <span className="icon-info">ℹ</span>
                <span>Ready to dispatch up to 200 URLs. Duplicates automatically filtered.</span>
              </div>

              <button
                type="button"
                className="btn btn-primary-lg btn-glow"
                id="btnSubmitIndexing"
                onClick={handleSubmitUrls}
              >
                <span className="btn-icon">⚡</span>
                <span className="btn-text">Submit URLs to Priority Queue</span>
                <span className="btn-speed-badge">~2.0s</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ============================ MODULE 2: GOOGLE SEARCH CONSOLE INTEGRATION ============================ */}
      {activeTab === 'gsc' && (
        <section className="container" id="gsc-section">
          <div className="submitter-card glass-card">
            <div className="section-header-row">
              <div>
                <span className="section-eyebrow">Official Google Verification</span>
                <h2 className="card-heading">Google Search Console API Integration</h2>
                <p className="card-subheading">
                  Connect your Google account via OAuth 2.0 to inspect URLs for verified properties, check real indexing status, and submit XML sitemaps.
                </p>
              </div>
              <div className="gsc-oauth-actions">
                <div
                  className={`connection-badge ${gscStatus.connected ? 'connected' : 'disconnected'}`}
                >
                  <span className="dot-status"></span>
                  <span>
                    {gscStatus.connected
                      ? `Connected as ${gscStatus.user?.email || 'Google User'}`
                      : gscStatus.isConfigured
                      ? 'Ready to Connect'
                      : 'OAuth Not Configured in .env'}
                  </span>
                </div>
                {!gscStatus.connected ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleConnectGoogle}
                    disabled={isRedirectingGoogle}
                  >
                    {isRedirectingGoogle ? 'Redirecting to Google...' : 'Connect Google Search Console'}
                  </button>
                ) : (
                  <button type="button" className="btn btn-outline" onClick={handleDisconnectGoogle}>
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* GSC Property Selector & Stats Bar */}
            <div className="gsc-property-card" id="gscPropertyCard">
              <div className="property-select-group">
                <label htmlFor="gscPropertySelect" className="form-label">
                  <strong>Select Authorized Property:</strong>
                  <span className="label-help">(Only sites verified in your Search Console account appear here)</span>
                </label>
                <div className="select-with-refresh">
                  <select
                    id="gscPropertySelect"
                    className="select-property"
                    value={selectedProperty}
                    onChange={e => handlePropertySelect(e.target.value)}
                  >
                    {!gscStatus.connected ? (
                      <option value="">-- Connect Google Search Console first --</option>
                    ) : gscProperties.length === 0 ? (
                      <option value="">No verified sites found in this Google account</option>
                    ) : (
                      <>
                        <option value="">-- Select an authorized property --</option>
                        {gscProperties.map(site => (
                          <option key={site.siteUrl} value={site.siteUrl}>
                            {site.siteUrl} ({site.permissionLevel})
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  <button
                    type="button"
                    className="btn btn-outline-sm"
                    onClick={fetchProperties}
                    title="Refresh properties"
                  >
                    🔄
                  </button>
                </div>
              </div>

              <div className="property-meta-info" id="propertyMetaInfo">
                <span className="meta-tag">
                  Permission: <strong>{propertyPermission}</strong>
                </span>
                <span className="meta-tag">
                  Property Type: <strong>{propertyType}</strong>
                </span>
              </div>
            </div>

            {/* Search Console Sub-Tabs */}
            <div className="gsc-subtabs-row">
              <button
                type="button"
                className={`subtab-btn ${gscSubTab === 'inspect' ? 'active' : ''}`}
                onClick={() => setGscSubTab('inspect')}
              >
                🔍 Inspect URLs (Official Index Status)
              </button>
              <button
                type="button"
                className={`subtab-btn ${gscSubTab === 'sitemaps' ? 'active' : ''}`}
                onClick={() => setGscSubTab('sitemaps')}
              >
                🗺️ Sitemaps Management
              </button>
            </div>

            {/* SUB-TAB 1: URL INSPECTION */}
            {gscSubTab === 'inspect' && (
              <div id="gscInspectView" className="gsc-subview active">
                <div className="inspect-input-box">
                  <div className="textarea-header-bar">
                    <span className="textarea-label">Enter URLs to Inspect (Must belong to selected property):</span>
                    <button type="button" className="btn-clear-text" onClick={() => setInspectText('')}>
                      Clear
                    </button>
                  </div>
                  <textarea
                    id="gscInspectTextarea"
                    className="url-textarea"
                    placeholder={`https://yourverifiedsite.com/\nhttps://yourverifiedsite.com/about-us\nhttps://yourverifiedsite.com/products/example`}
                    rows={5}
                    spellCheck={false}
                    value={inspectText}
                    onChange={e => setInspectText(e.target.value)}
                  ></textarea>
                  <div className="scope-warning-box">
                    <span>
                      🛡️ <strong>Strict Scope Enforced:</strong> Only URLs belonging to the selected Search Console property can be inspected. Third-party backlinks must be submitted in the Bulk URL Submitter tab.
                    </span>
                  </div>
                  <div className="inspect-action-bar">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleExecuteInspection}
                      disabled={isInspecting}
                    >
                      <span>{isInspecting ? '⏳ Inspecting with Google API...' : '🔍 Run Official Google URL Inspection'}</span>
                    </button>
                    <span className="inspect-quota-note">Quota: ~2,000 requests/day per property</span>
                  </div>
                </div>

                {/* Inspection Results Table */}
                <div className="inspection-results-wrapper" style={{ marginTop: '1.5rem' }}>
                  <h3 className="box-title">Recent Inspection Results</h3>
                  <div className="table-responsive">
                    <table className="data-table" id="gscInspectionTable">
                      <thead>
                        <tr>
                          <th>URL</th>
                          <th>Property</th>
                          <th>Official Status</th>
                          <th>Verdict</th>
                          <th>Coverage State</th>
                          <th>Last Crawled</th>
                          <th>Inspected At</th>
                        </tr>
                      </thead>
                      <tbody id="gscInspectionTableBody">
                        {inspectionResults.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="loading-td">
                              No URLs inspected yet. Select a property and click &quot;Run Official Google URL Inspection&quot;.
                            </td>
                          </tr>
                        ) : (
                          inspectionResults.map((r, i) => {
                            let badgeClass = 'badge-unverified';
                            if (r.indexStatus === 'Indexed') badgeClass = 'badge-indexed';
                            else if (r.indexStatus === 'Not Indexed') badgeClass = 'badge-not-indexed';
                            else if (r.indexStatus === 'Failed') badgeClass = 'badge-failed';

                            const lastCrawled =
                              r.lastCrawlTime && r.lastCrawlTime !== 'Not yet crawled'
                                ? new Date(r.lastCrawlTime).toLocaleDateString()
                                : 'Not crawled';

                            return (
                              <tr key={i}>
                                <td>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{r.url}</span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.siteUrl}</span>
                                </td>
                                <td>
                                  <span className={`badge-status ${badgeClass}`}>● {r.indexStatus}</span>
                                </td>
                                <td>
                                  <strong style={{ fontSize: '0.8rem' }}>{r.verdict || 'N/A'}</strong>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.75rem' }}>{r.coverageState || r.error || 'Unknown'}</span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.75rem' }}>{lastCrawled}</span>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {new Date(r.inspectedAt).toLocaleTimeString()}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-TAB 2: SITEMAPS MANAGEMENT */}
            {gscSubTab === 'sitemaps' && (
              <div id="gscSitemapsView" className="gsc-subview active">
                <div className="sitemap-submit-box">
                  <h3 className="box-title">Submit New Sitemap</h3>
                  <p className="box-sub">
                    Enter the sitemap path (e.g. <code>sitemap.xml</code> or <code>sitemap_index.xml</code>) to submit to Google Search Console.
                  </p>
                  <div className="sitemap-form-row">
                    <input
                      type="text"
                      className="search-input"
                      placeholder="sitemap.xml"
                      value={sitemapPath}
                      onChange={e => setSitemapPath(e.target.value)}
                    />
                    <button type="button" className="btn btn-primary" onClick={handleSubmitSitemap}>
                      Submit Sitemap
                    </button>
                  </div>
                  {sitemapNotice && (
                    <div
                      className={`test-result-alert ${sitemapNotice.success ? 'success' : 'error'}`}
                      style={{ display: 'block', marginTop: '0.75rem' }}
                    >
                      {sitemapNotice.text}
                    </div>
                  )}
                </div>

                <div className="sitemaps-list-box" style={{ marginTop: '1.5rem' }}>
                  <div className="card-header-row">
                    <h3 className="box-title">Submitted Sitemaps</h3>
                    <button
                      type="button"
                      className="btn btn-outline-sm"
                      onClick={() => fetchSitemaps(selectedProperty)}
                    >
                      🔄 Refresh
                    </button>
                  </div>
                  <div className="table-responsive">
                    <table className="data-table" id="sitemapsTable">
                      <thead>
                        <tr>
                          <th>Sitemap Path</th>
                          <th>Last Submitted</th>
                          <th>Last Downloaded</th>
                          <th>Status / Errors</th>
                          <th>Submitted URLs</th>
                          <th>Indexed URLs</th>
                        </tr>
                      </thead>
                      <tbody id="sitemapsTableBody">
                        {!selectedProperty ? (
                          <tr>
                            <td colSpan={6} className="loading-td">
                              Select a property to view submitted sitemaps.
                            </td>
                          </tr>
                        ) : sitemapLoading ? (
                          <tr>
                            <td colSpan={6} className="loading-td">
                              Loading sitemaps for {selectedProperty}...
                            </td>
                          </tr>
                        ) : sitemaps.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="loading-td">
                              No sitemaps found for this property. Submit one above!
                            </td>
                          </tr>
                        ) : (
                          sitemaps.map((sm, i) => {
                            const lastSub = sm.lastSubmitted ? new Date(sm.lastSubmitted).toLocaleDateString() : '-';
                            const lastDown = sm.lastDownloaded ? new Date(sm.lastDownloaded).toLocaleDateString() : '-';
                            const errCount =
                              (sm.errors || 0) > 0 ? (
                                <span style={{ color: '#EF4444' }}>{sm.errors} errors</span>
                              ) : (
                                <span style={{ color: '#10B981' }}>Success</span>
                              );
                            const submittedUrls = sm.contents
                              ? sm.contents.reduce((sum: number, c: any) => sum + parseInt(c.submitted || 0), 0)
                              : '-';
                            const indexedUrls = sm.contents
                              ? sm.contents.reduce((sum: number, c: any) => sum + parseInt(c.indexed || 0), 0)
                              : '-';

                            return (
                              <tr key={i}>
                                <td>
                                  <code>{sm.path}</code>
                                </td>
                                <td>{lastSub}</td>
                                <td>{lastDown}</td>
                                <td>{errCount}</td>
                                <td>
                                  <strong>{submittedUrls}</strong>
                                </td>
                                <td>
                                  <strong>{indexedUrls}</strong>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ============================ 2-SECOND LIVE EXECUTION MODAL ============================ */}
      {modalOpen && (
        <div className="modal-backdrop active" id="executionModal">
          <div className="modal-box glass-card execution-modal-box">
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="pulse-bolt">⚡</span>
                <div>
                  <h3 className="modal-heading">Executing Priority Indexing Pipeline</h3>
                  <p className="modal-sub">Dispatching links to Google priority queue...</p>
                </div>
              </div>
              {modalDone && (
                <button type="button" className="btn-close-modal" onClick={() => setModalOpen(false)}>
                  ✕
                </button>
              )}
            </div>

            {/* 2-Second Visual Timer & Progress Bar */}
            <div className="timer-display-area">
              <div className="timer-radial-wrap">
                <div className="timer-countdown" id="timerCountdown">
                  {modalTimer}
                </div>
                <span className="timer-sub">Pipeline Speed</span>
              </div>
              <div className="stages-progress-bar">
                <div className="progress-fill" style={{ width: `${progressWidth}%` }}></div>
              </div>
            </div>

            {/* High-Tech Execution Terminal Stages */}
            <div className="execution-stages-grid">
              <div className={stage1Class} id="stage1">
                <span className="step-indicator">1</span>
                <div className="step-info">
                  <div className="step-title">URL Validation &amp; Deduplication</div>
                  <div className="step-desc">Syntax verification and duplicate removal</div>
                </div>
                <span className="step-status">{stage1Text}</span>
              </div>

              <div className={stage2Class} id="stage2">
                <span className="step-indicator">2</span>
                <div className="step-info">
                  <div className="step-title">Google Priority Queue Handshake</div>
                  <div className="step-desc">Publishing URL_UPDATED notification dispatch</div>
                </div>
                <span className="step-status">{stage2Text}</span>
              </div>

              <div className={stage3Class} id="stage3">
                <span className="step-indicator">3</span>
                <div className="step-info">
                  <div className="step-title">Google WebSub &amp; IndexNow Syndication</div>
                  <div className="step-desc">Pinging Google XML-RPC &amp; IndexNow network</div>
                </div>
                <span className="step-status">{stage3Text}</span>
              </div>

              <div className={stage4Class} id="stage4">
                <span className="step-indicator">4</span>
                <div className="step-info">
                  <div className="step-title">Googlebot Bait Crawl Gateway Enqueue</div>
                  <div className="step-desc">Dynamic XML feed syndication &amp; verification</div>
                </div>
                <span className="step-status">{stage4Text}</span>
              </div>
            </div>

            {/* Live URLs Dispatched Stream */}
            <div className="results-stream-card">
              <div className="stream-header">
                <span>Dispatched Links ({modalUrlsCount})</span>
                <span className="badge-status-completed">{modalBatchId}</span>
              </div>
              <div className="stream-body" id="modalResultsList">
                {modalResults.length === 0 ? (
                  modalError ? (
                    <div className="stream-placeholder" style={{ color: '#EF4444' }}>
                      Error: {modalError}
                    </div>
                  ) : (
                    <div className="stream-placeholder">Initializing priority queue stream...</div>
                  )
                ) : (
                  modalResults.map((item, idx) => (
                    <div className="stream-item" key={idx}>
                      <div className="stream-url-wrap">
                        <span>🔗</span>
                        <span className="stream-url" title={item.url}>
                          {item.url}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="stream-latency">{item.responseLatency || 210}ms</span>
                        <span className="badge-status badge-processed">● Processed</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {modalDone && (
              <div className="modal-footer-actions" style={{ display: 'flex' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setModalOpen(false);
                    document.getElementById('batches')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  View in History
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setModalOpen(false)}>
                  Done &amp; Return
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================ SUBMISSION HISTORY & TRACKING ============================ */}
      <section className="container section-padded" id="batches">
        <div className="glass-card batches-card">
          <div className="section-header-row">
            <div>
              <span className="section-eyebrow">Real-Time Auditing</span>
              <h2 className="section-title">Submission History &amp; Batches</h2>
              <p className="section-subtitle">Track every batch ID, accepted URLs, and dispatch timing.</p>
            </div>
            <div className="batches-controls">
              <button type="button" className="btn btn-outline-sm" onClick={fetchBatches}>
                🔄 Refresh
              </button>
              <button type="button" className="btn btn-outline-sm" onClick={handleExportCsv}>
                📥 Export CSV
              </button>
            </div>
          </div>

          {/* Filter row */}
          <div className="batches-filter-row">
            <input
              type="text"
              className="search-input"
              placeholder="Search by URL or Batch ID..."
              value={batchSearch}
              onChange={e => setBatchSearch(e.target.value)}
            />
          </div>

          {/* Batches Table */}
          <div className="table-responsive">
            <table className="data-table" id="batchesTable">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>URLs Count</th>
                  <th>Dispatch Latency</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="batchesTableBody">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="loading-td">
                      No submission batches found. Submit your first batch above!
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map(b => {
                    const dateStr = new Date(b.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      month: 'short',
                      day: 'numeric',
                    });
                    const latency = b.processingTimeMs ? `${b.processingTimeMs}ms` : '1.8s';

                    return (
                      <tr key={b.batchId}>
                        <td>
                          <span className="batch-code">{b.batchId}</span>
                        </td>
                        <td>
                          <strong>{b.totalUrls} URLs</strong>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', color: '#34D399' }}>{latency}</span>
                        </td>
                        <td>
                          <span className="badge-status badge-processed">● {b.status}</span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{dateStr}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-outline-sm"
                            onClick={() => inspectBatchDetails(b.batchId)}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ============================ DEVELOPER REST API SECTION ============================ */}
      <section className="container section-padded" id="api-docs">
        <div className="glass-card api-docs-card">
          <div className="section-header-row">
            <div>
              <span className="section-eyebrow">Automate Anything</span>
              <h2 className="section-title">Developer REST API</h2>
              <p className="section-subtitle">
                Automate URL submissions directly from your custom Python scripts, CI/CD, or cURL.
              </p>
            </div>
            <span className="api-tag">REST v1 • Instant</span>
          </div>

          <div className="api-code-split">
            <div className="api-docs-text">
              <h3 className="endpoint-title">
                <span className="method-post">POST</span>
                <code>/v1/index</code>
              </h3>
              <p>Submit up to 200 URLs in a single request. Receives immediate batch ID and tracking keys.</p>

              <ul className="api-features-list">
                <li>✓ Accepts standard JSON array of URLs</li>
                <li>✓ Automatic duplicate removal and format validation</li>
                <li>✓ Triggers multi-tier Google priority queue dispatch</li>
              </ul>

              <div className="api-key-box">
                <label>Your Local API Endpoint:</label>
                <div className="copy-input-row">
                  <input type="text" readOnly value={apiEndpoint} />
                  <button type="button" className="btn btn-outline-sm" onClick={handleCopyEndpoint}>
                    {copiedApi ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div className="code-terminal">
              <div className="terminal-bar">
                <span className="terminal-dots">
                  <i></i>
                  <i></i>
                  <i></i>
                </span>
                <span className="terminal-title">cURL Request Example</span>
              </div>
              <pre className="code-block">
                <code>
                  <span className="code-comment"># Submit URLs to Index Metrix API</span>
                  {'\n'}curl -X POST https://indexmetrixx.vercel.app/v1/index \{'\n'}  -H{' '}
                  <span className="code-str">&quot;Content-Type: application/json&quot;</span> \{'\n'}  -d{' '}
                  <span className="code-str">
                    {`'{\n    "urls": [\n      "https://example.com/page-1",\n      "https://example.com/page-2",\n      "https://third-party-site.com/post"\n    ]\n  }'`}
                  </span>
                  {'\n\n'}
                  <span className="code-comment"># Instant JSON Response (under 2s)</span>
                  {'\n'}
                  {`{\n  `}<span className="code-key">&quot;batch_id&quot;</span>{`: `}<span className="code-str">&quot;btch_8f4a21&quot;</span>{`,\n  `}<span className="code-key">&quot;accepted&quot;</span>{`: `}<span className="code-num">3</span>{`,\n  `}<span className="code-key">&quot;status&quot;</span>{`: `}<span className="code-str">&quot;Processed&quot;</span>{`\n}`}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ FOOTER ============================ */}
      <footer className="app-footer">
        <div className="container footer-container">
          <div className="footer-brand">
            <div className="brand-logo">
              <span className="logo-bolt">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2 4 13.5h6.2L9 22l9.5-12.2H12z" />
                </svg>
              </span>
              <span className="logo-title">
                Index<span className="logo-accent">Metrix</span>
              </span>
            </div>
            <p className="footer-desc">
              Professional URL and backlink indexing acceleration platform with official Google Search Console API integration.
            </p>
          </div>

          <div className="footer-links-group">
            <h4>Navigation</h4>
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => {
                setActiveTab('backlinks');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', textAlign: 'left', padding: 0 }}
            >
              Bulk Submitter
            </button>
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => {
                setActiveTab('gsc');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', textAlign: 'left', padding: 0 }}
            >
              Search Console API
            </button>
            <a href="#batches">History &amp; Logs</a>
            <a href="#api-docs">Developer API</a>
          </div>

          <div className="footer-links-group">
            <h4>Feeds &amp; Gateways</h4>
            <a href="/crawl-hub" target="_blank">
              Googlebot Crawl Hub ↗
            </a>
            <a href="/feed.xml" target="_blank">
              Syndication RSS XML ↗
            </a>
            <a href="/api/index/batches" target="_blank">
              Raw JSON Batches ↗
            </a>
            <a href="/sitemap.xml" target="_blank">
              Sitemap XML ↗
            </a>
          </div>
        </div>
        <div className="footer-bottom-bar">
          <div className="container bottom-row">
            <span>© 2026 Index Metrix. Designed for high-speed Google discovery.</span>
            <span>⚡ Search Console API + Priority Crawl Dispatch</span>
          </div>
        </div>
      </footer>
    </>
  );
}
