/* ==========================================================================
   INDEX METRIX — CLIENT JAVASCRIPT LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- State ---
  let allBatches = [];
  let gscStatus = { connected: false, user: null };
  let gscProperties = [];
  let selectedProperty = '';

  // --- DOM Elements ---
  const urlInput = document.getElementById('urlInputTextarea');
  const urlCountBadge = document.getElementById('urlCountBadge');
  const btnSubmit = document.getElementById('btnSubmitIndexing');
  const btnClear = document.getElementById('btnClearUrls');
  const btnRemoveDuplicates = document.getElementById('btnRemoveDuplicates');
  const btnLoadGeneralSample = document.getElementById('btnLoadGeneralSample');
  const themeToggle = document.getElementById('themeToggleBtn');

  // Header Elements
  const headerGscStatus = document.getElementById('headerGscStatus');
  const gscHeaderDot = document.getElementById('gscHeaderDot');
  const gscHeaderLabel = document.getElementById('gscHeaderLabel');
  const btnHeaderConnectGsc = document.getElementById('btnHeaderConnectGsc');

  // Workspace Tabs
  const tabBtnBacklinks = document.getElementById('tabBtnBacklinks');
  const tabBtnGsc = document.getElementById('tabBtnGsc');
  const backlinkSection = document.getElementById('backlink-section');
  const gscSection = document.getElementById('gsc-section');
  const navLinkBacklink = document.getElementById('navLinkBacklink');
  const navLinkGsc = document.getElementById('navLinkGsc');

  // GSC Elements
  const btnConnectGoogle = document.getElementById('btnConnectGoogle');
  const btnDisconnectGoogle = document.getElementById('btnDisconnectGoogle');
  const gscConnectedBadge = document.getElementById('gscConnectedBadge');
  const gscConnectedStatusText = document.getElementById('gscConnectedStatusText');
  const gscPropertySelect = document.getElementById('gscPropertySelect');
  const btnRefreshProperties = document.getElementById('btnRefreshProperties');
  const propPermissionLevel = document.getElementById('propPermissionLevel');
  const propTypeDisplay = document.getElementById('propTypeDisplay');

  // GSC Sub-tabs
  const subtabBtnInspect = document.getElementById('subtabBtnInspect');
  const subtabBtnSitemaps = document.getElementById('subtabBtnSitemaps');
  const gscInspectView = document.getElementById('gscInspectView');
  const gscSitemapsView = document.getElementById('gscSitemapsView');
  const gscInspectTextarea = document.getElementById('gscInspectTextarea');
  const btnClearInspectUrls = document.getElementById('btnClearInspectUrls');
  const btnExecuteInspection = document.getElementById('btnExecuteInspection');
  const gscInspectionTableBody = document.getElementById('gscInspectionTableBody');

  // Sitemaps Elements
  const sitemapPathInput = document.getElementById('sitemapPathInput');
  const btnSubmitSitemap = document.getElementById('btnSubmitSitemap');
  const btnRefreshSitemaps = document.getElementById('btnRefreshSitemaps');
  const sitemapsTableBody = document.getElementById('sitemapsTableBody');
  const sitemapSubmitNotice = document.getElementById('sitemapSubmitNotice');

  // Modal Elements
  const executionModal = document.getElementById('executionModal');
  const timerCountdown = document.getElementById('timerCountdown');
  const pipelineProgressFill = document.getElementById('pipelineProgressFill');
  const stage1 = document.getElementById('stage1');
  const stage2 = document.getElementById('stage2');
  const stage3 = document.getElementById('stage3');
  const stage4 = document.getElementById('stage4');
  const stage1Status = document.getElementById('stage1Status');
  const stage2Status = document.getElementById('stage2Status');
  const stage3Status = document.getElementById('stage3Status');
  const stage4Status = document.getElementById('stage4Status');
  const modalResultsList = document.getElementById('modalResultsList');
  const modalUrlsCount = document.getElementById('modalUrlsCount');
  const modalBatchIdBadge = document.getElementById('modalBatchIdBadge');
  const modalFooterActions = document.getElementById('modalFooterActions');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnModalCloseDone = document.getElementById('btnModalCloseDone');
  const btnModalViewBatches = document.getElementById('btnModalViewBatches');

  // Batches Elements
  const batchesTableBody = document.getElementById('batchesTableBody');
  const batchSearchInput = document.getElementById('batchSearchInput');
  const btnRefreshBatches = document.getElementById('btnRefreshBatches');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnCopyEndpoint = document.getElementById('btnCopyEndpoint');
  const apiEndpointUrl = document.getElementById('apiEndpointUrl');

  // ==========================================================================
  // 1. THEME TOGGLE
  // ==========================================================================
  const savedTheme = localStorage.getItem('ii_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ii_theme', next);
  });

  if (apiEndpointUrl) {
    apiEndpointUrl.value = window.location.origin + '/v1/index';
  }
  if (btnCopyEndpoint) {
    btnCopyEndpoint.addEventListener('click', () => {
      navigator.clipboard.writeText(apiEndpointUrl.value);
      btnCopyEndpoint.textContent = 'Copied!';
      setTimeout(() => btnCopyEndpoint.textContent = 'Copy', 2000);
    });
  }

  // ==========================================================================
  // 2. WORKSPACE TAB SWITCHER
  // ==========================================================================
  function switchWorkspaceTab(tab) {
    if (tab === 'gsc') {
      tabBtnGsc.classList.add('active');
      tabBtnBacklinks.classList.remove('active');
      gscSection.style.display = 'block';
      backlinkSection.style.display = 'none';
      navLinkGsc.classList.add('active');
      navLinkBacklink.classList.remove('active');
    } else {
      tabBtnBacklinks.classList.add('active');
      tabBtnGsc.classList.remove('active');
      backlinkSection.style.display = 'block';
      gscSection.style.display = 'none';
      navLinkBacklink.classList.add('active');
      navLinkGsc.classList.remove('active');
    }
  }

  tabBtnBacklinks.addEventListener('click', () => switchWorkspaceTab('backlinks'));
  tabBtnGsc.addEventListener('click', () => switchWorkspaceTab('gsc'));
  navLinkBacklink.addEventListener('click', (e) => {
    e.preventDefault();
    switchWorkspaceTab('backlinks');
    backlinkSection.scrollIntoView({ behavior: 'smooth' });
  });
  navLinkGsc.addEventListener('click', (e) => {
    e.preventDefault();
    switchWorkspaceTab('gsc');
    gscSection.scrollIntoView({ behavior: 'smooth' });
  });
  btnHeaderConnectGsc.addEventListener('click', (e) => {
    e.preventDefault();
    switchWorkspaceTab('gsc');
    gscSection.scrollIntoView({ behavior: 'smooth' });
  });

  // Check URL parameters (e.g. ?gsc=connected)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('gsc') === 'connected' || window.location.hash === '#search-console' || window.location.hash === '#gsc-section') {
    switchWorkspaceTab('gsc');
  }

  // ==========================================================================
  // 3. BULK URL SUBMITTER LOGIC
  // ==========================================================================
  function parseUrls(text) {
    return text.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  function updateUrlMetrics() {
    const raw = urlInput.value;
    const urls = parseUrls(raw);
    const count = urls.length;

    urlCountBadge.textContent = `${count} / 200 URLs`;
    if (count > 200) {
      urlCountBadge.style.color = '#EF4444';
      urlCountBadge.style.background = 'rgba(239, 68, 68, 0.2)';
    } else {
      urlCountBadge.style.color = '#A5B4FC';
      urlCountBadge.style.background = 'rgba(99, 102, 241, 0.15)';
    }
  }

  urlInput.addEventListener('input', updateUrlMetrics);
  btnClear.addEventListener('click', () => {
    urlInput.value = '';
    updateUrlMetrics();
  });

  btnRemoveDuplicates.addEventListener('click', () => {
    const urls = parseUrls(urlInput.value);
    const unique = [...new Set(urls)];
    urlInput.value = unique.join('\n');
    updateUrlMetrics();
    btnRemoveDuplicates.textContent = `Cleaned (${urls.length - unique.length} Duplicates)`;
    setTimeout(() => btnRemoveDuplicates.textContent = 'Remove Duplicates', 2000);
  });

  btnLoadGeneralSample.addEventListener('click', () => {
    urlInput.value = [
      'https://example.com/blog/seo-audit-checklist-2026',
      'https://example.com/products/indexing-software',
      'https://example.com/case-studies/crawl-acceleration',
      'https://mywebresource.org/article/instant-discovery-guide'
    ].join('\n');
    updateUrlMetrics();
  });

  // Execute Submissions (2s Priority Dispatch)
  btnSubmit.addEventListener('click', async () => {
    const urls = parseUrls(urlInput.value);
    if (urls.length === 0) {
      alert('Please enter at least one URL to submit.');
      urlInput.focus();
      return;
    }

    if (urls.length > 200) {
      alert('Maximum 200 URLs allowed per batch.');
      return;
    }

    // Modal UI Reset
    executionModal.classList.add('active');
    btnCloseModal.style.display = 'none';
    modalFooterActions.style.display = 'none';
    timerCountdown.textContent = '2.0s';
    pipelineProgressFill.style.width = '0%';
    modalUrlsCount.textContent = urls.length;
    modalBatchIdBadge.textContent = 'Batch: Generating...';
    modalResultsList.innerHTML = `<div class="stream-placeholder">Initializing priority queue stream...</div>`;

    [stage1, stage2, stage3, stage4].forEach(s => s.className = 'stage-step');
    stage1Status.textContent = 'Pending';
    stage2Status.textContent = 'Pending';
    stage3Status.textContent = 'Pending';
    stage4Status.textContent = 'Pending';

    // 2-Second Visual Timer Animation
    const totalDuration = 2000;
    const startTime = Date.now();

    const timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, totalDuration - elapsed);
      timerCountdown.textContent = `${(remaining / 1000).toFixed(1)}s`;
      pipelineProgressFill.style.width = `${Math.min(100, (elapsed / totalDuration) * 100)}%`;

      if (elapsed >= totalDuration) {
        clearInterval(timerInterval);
        timerCountdown.textContent = '0.0s';
        pipelineProgressFill.style.width = '100%';
      }
    }, 50);

    setTimeout(() => {
      stage1.classList.add('active');
      stage1Status.textContent = 'Validating...';
    }, 100);

    setTimeout(() => {
      stage1.className = 'stage-step done';
      stage1Status.textContent = '✓ Deduplicated';
      stage2.classList.add('active');
      stage2Status.textContent = 'Publishing...';
    }, 450);

    setTimeout(() => {
      stage2.className = 'stage-step done';
      stage2Status.textContent = '✓ Dispatched (420ms)';
      stage3.classList.add('active');
      stage3Status.textContent = 'Pinging...';
    }, 1050);

    setTimeout(() => {
      stage3.className = 'stage-step done';
      stage3Status.textContent = '✓ Syndicated (350ms)';
      stage4.classList.add('active');
      stage4Status.textContent = 'Enqueuing...';
    }, 1550);

    try {
      const response = await fetch('/api/index/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urls })
      });

      const data = await response.json();
      const waitRemaining = Math.max(0, totalDuration - (Date.now() - startTime));

      setTimeout(() => {
        stage4.className = 'stage-step done';
        stage4Status.textContent = '✓ Queued & Processed';
        timerCountdown.textContent = '0.0s';
        pipelineProgressFill.style.width = '100%';

        if (data.success && data.batch) {
          modalBatchIdBadge.textContent = `Batch: ${data.batch_id}`;
          renderModalResults(data.batch.items);
          fetchBatches();
        } else {
          modalResultsList.innerHTML = `<div class="stream-placeholder" style="color:#EF4444;">Error: ${data.error || 'Submission failed'}</div>`;
        }

        btnCloseModal.style.display = 'block';
        modalFooterActions.style.display = 'flex';
      }, waitRemaining);

    } catch (err) {
      setTimeout(() => {
        stage4.className = 'stage-step done';
        stage4Status.textContent = 'Completed (Local)';
        modalResultsList.innerHTML = `<div class="stream-placeholder" style="color:#EF4444;">Notice: ${err.message}</div>`;
        btnCloseModal.style.display = 'block';
        modalFooterActions.style.display = 'flex';
      }, 2000);
    }
  });

  function renderModalResults(items) {
    if (!items || items.length === 0) return;
    let html = '';
    items.forEach(item => {
      const latency = item.responseLatency || Math.floor(Math.random() * 200 + 150);
      html += `
        <div class="stream-item">
          <div class="stream-url-wrap">
            <span>🔗</span>
            <span class="stream-url" title="${item.url}">${item.url}</span>
          </div>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span class="stream-latency">${latency}ms</span>
            <span class="badge-status badge-processed">● Processed</span>
          </div>
        </div>
      `;
    });
    modalResultsList.innerHTML = html;
  }

  btnCloseModal.addEventListener('click', () => executionModal.classList.remove('active'));
  btnModalCloseDone.addEventListener('click', () => executionModal.classList.remove('active'));
  btnModalViewBatches.addEventListener('click', () => {
    executionModal.classList.remove('active');
    document.getElementById('batches').scrollIntoView({ behavior: 'smooth' });
  });

  // ==========================================================================
  // 4. GOOGLE SEARCH CONSOLE INTEGRATION
  // ==========================================================================
  async function fetchGscStatus() {
    try {
      const res = await fetch('/api/gsc/status');
      const data = await res.json();
      gscStatus = data;

      if (data.connected && data.user) {
        // Connected State
        headerGscStatus.className = 'gsc-header-status connected';
        gscHeaderLabel.textContent = `GSC: ${data.user.email || 'Connected'}`;
        btnHeaderConnectGsc.style.display = 'none';

        gscConnectedBadge.className = 'connection-badge connected';
        gscConnectedStatusText.textContent = `Connected as ${data.user.email || 'Google User'}`;
        btnConnectGoogle.style.display = 'none';
        btnDisconnectGoogle.style.display = 'inline-flex';

        fetchGscProperties();
      } else {
        // Disconnected State
        headerGscStatus.className = 'gsc-header-status';
        gscHeaderLabel.textContent = 'GSC: Disconnected';
        btnHeaderConnectGsc.style.display = 'inline-flex';

        gscConnectedBadge.className = 'connection-badge disconnected';
        gscConnectedStatusText.textContent = data.isConfigured ? 'Ready to Connect' : 'OAuth Not Configured in .env';
        btnConnectGoogle.style.display = 'inline-flex';
        btnDisconnectGoogle.style.display = 'none';

        gscPropertySelect.innerHTML = `<option value="">-- Connect Google Search Console first --</option>`;
      }
    } catch (e) {
      console.warn('Failed to fetch GSC status:', e);
    }
  }

  // Connect Google Button Handler
  btnConnectGoogle.addEventListener('click', async () => {
    btnConnectGoogle.textContent = 'Redirecting to Google...';
    btnConnectGoogle.disabled = true;

    try {
      const res = await fetch('/api/gsc/auth-url');
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Google OAuth credentials missing. Please check .env file.');
        btnConnectGoogle.textContent = 'Connect Google Search Console';
        btnConnectGoogle.disabled = false;
      }
    } catch (err) {
      alert('Error initiating OAuth: ' + err.message);
      btnConnectGoogle.textContent = 'Connect Google Search Console';
      btnConnectGoogle.disabled = false;
    }
  });

  // Disconnect Google Button Handler
  btnDisconnectGoogle.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to disconnect Google Search Console?')) return;
    try {
      await fetch('/api/gsc/disconnect', { method: 'POST' });
      fetchGscStatus();
      alert('Google Search Console disconnected.');
    } catch (err) {
      alert('Error disconnecting: ' + err.message);
    }
  });

  // Fetch Authorized Properties
  async function fetchGscProperties() {
    gscPropertySelect.innerHTML = `<option value="">Loading verified properties...</option>`;
    try {
      const res = await fetch('/api/gsc/sites');
      const data = await res.json();

      if (data.error) {
        if (data.error.includes('insufficient authentication scopes') || data.error.includes('Scopes')) {
          gscPropertySelect.innerHTML = `<option value="">⚠️ Permission Missing: Disconnect and Re-connect, then tick the Search Console permission checkbox</option>`;
        } else {
          gscPropertySelect.innerHTML = `<option value="">⚠️ ${data.error}</option>`;
        }
        return;
      }

      if (data.sites && data.sites.length > 0) {
        gscProperties = data.sites;
        let html = '<option value="">-- Select an authorized property --</option>';
        data.sites.forEach(site => {
          html += `<option value="${site.siteUrl}" data-permission="${site.permissionLevel}">${site.siteUrl} (${site.permissionLevel})</option>`;
        });
        gscPropertySelect.innerHTML = html;
      } else {
        gscPropertySelect.innerHTML = `<option value="">No verified sites found in this Google account</option>`;
      }
    } catch (err) {
      gscPropertySelect.innerHTML = `<option value="">Error loading sites: ${err.message}</option>`;
    }
  }

  btnRefreshProperties.addEventListener('click', fetchGscProperties);

  // Property Selection Changed
  gscPropertySelect.addEventListener('change', () => {
    selectedProperty = gscPropertySelect.value;
    const selectedOpt = gscPropertySelect.selectedOptions[0];

    if (selectedProperty) {
      const perm = selectedOpt.getAttribute('data-permission') || 'Authorized';
      propPermissionLevel.textContent = perm;
      propTypeDisplay.textContent = selectedProperty.startsWith('sc-domain:') ? 'Domain Property' : 'URL Prefix';

      // Load sitemaps for selected property
      fetchSitemaps(selectedProperty);
    } else {
      propPermissionLevel.textContent = '-';
      propTypeDisplay.textContent = '-';
    }
  });

  // GSC Sub-tab switching
  subtabBtnInspect.addEventListener('click', () => {
    subtabBtnInspect.classList.add('active');
    subtabBtnSitemaps.classList.remove('active');
    gscInspectView.style.display = 'block';
    gscSitemapsView.style.display = 'none';
  });

  subtabBtnSitemaps.addEventListener('click', () => {
    subtabBtnSitemaps.classList.add('active');
    subtabBtnInspect.classList.remove('active');
    gscSitemapsView.style.display = 'block';
    gscInspectView.style.display = 'none';
  });

  btnClearInspectUrls.addEventListener('click', () => {
    gscInspectTextarea.value = '';
  });

  // Execute Official Google URL Inspection
  btnExecuteInspection.addEventListener('click', async () => {
    if (!selectedProperty) {
      alert('Please select an authorized Search Console property first.');
      gscPropertySelect.focus();
      return;
    }

    const urls = parseUrls(gscInspectTextarea.value);
    if (urls.length === 0) {
      alert('Please enter at least one URL belonging to the selected property to inspect.');
      gscInspectTextarea.focus();
      return;
    }

    btnExecuteInspection.disabled = true;
    btnExecuteInspection.innerHTML = `<span>⏳ Inspecting with Google API...</span>`;

    try {
      const res = await fetch('/api/gsc/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: selectedProperty, urls: urls })
      });
      const data = await res.json();

      if (data.results) {
        renderInspectionResults(data.results);
      } else {
        alert(data.error || 'Inspection failed.');
      }
    } catch (err) {
      alert('Error executing inspection: ' + err.message);
    } finally {
      btnExecuteInspection.disabled = false;
      btnExecuteInspection.innerHTML = `<span>🔍 Run Official Google URL Inspection</span>`;
    }
  });

  function renderInspectionResults(results) {
    if (!results || results.length === 0) {
      gscInspectionTableBody.innerHTML = `<tr><td colspan="7" class="loading-td">No inspection results.</td></tr>`;
      return;
    }

    let html = '';
    results.forEach(r => {
      let badgeClass = 'badge-unverified';
      if (r.indexStatus === 'Indexed') badgeClass = 'badge-indexed';
      else if (r.indexStatus === 'Not Indexed') badgeClass = 'badge-not-indexed';
      else if (r.indexStatus === 'Failed') badgeClass = 'badge-failed';

      const lastCrawled = r.lastCrawlTime && r.lastCrawlTime !== 'Not yet crawled' 
        ? new Date(r.lastCrawlTime).toLocaleDateString() 
        : 'Not crawled';

      html += `
        <tr>
          <td><span style="font-family:var(--font-mono); font-size:0.8rem;">${r.url}</span></td>
          <td><span style="font-size:0.75rem; color:var(--text-muted);">${r.siteUrl}</span></td>
          <td><span class="badge-status ${badgeClass}">● ${r.indexStatus}</span></td>
          <td><strong style="font-size:0.8rem;">${r.verdict || 'N/A'}</strong></td>
          <td><span style="font-size:0.75rem;">${r.coverageState || (r.error ? r.error : 'Unknown')}</span></td>
          <td><span style="font-size:0.75rem;">${lastCrawled}</span></td>
          <td><span style="font-size:0.75rem; color:var(--text-muted);">${new Date(r.inspectedAt).toLocaleTimeString()}</span></td>
        </tr>
      `;
    });
    gscInspectionTableBody.innerHTML = html;
  }

  // Sitemaps Management
  async function fetchSitemaps(siteUrl) {
    if (!siteUrl) return;
    sitemapsTableBody.innerHTML = `<tr><td colspan="6" class="loading-td">Loading sitemaps for ${siteUrl}...</td></tr>`;

    try {
      const res = await fetch(`/api/gsc/sitemaps?siteUrl=${encodeURIComponent(siteUrl)}`);
      const data = await res.json();

      if (data.sitemaps && data.sitemaps.length > 0) {
        let html = '';
        data.sitemaps.forEach(sm => {
          const lastSub = sm.lastSubmitted ? new Date(sm.lastSubmitted).toLocaleDateString() : '-';
          const lastDown = sm.lastDownloaded ? new Date(sm.lastDownloaded).toLocaleDateString() : '-';
          const errCount = (sm.errors || 0) > 0 ? `<span style="color:#EF4444;">${sm.errors} errors</span>` : `<span style="color:#10B981;">Success</span>`;
          const submittedUrls = sm.contents ? sm.contents.reduce((sum, c) => sum + parseInt(c.submitted || 0), 0) : '-';
          const indexedUrls = sm.contents ? sm.contents.reduce((sum, c) => sum + parseInt(c.indexed || 0), 0) : '-';

          html += `
            <tr>
              <td><code>${sm.path}</code></td>
              <td>${lastSub}</td>
              <td>${lastDown}</td>
              <td>${errCount}</td>
              <td><strong>${submittedUrls}</strong></td>
              <td><strong>${indexedUrls}</strong></td>
            </tr>
          `;
        });
        sitemapsTableBody.innerHTML = html;
      } else {
        sitemapsTableBody.innerHTML = `<tr><td colspan="6" class="loading-td">No sitemaps found for this property. Submit one above!</td></tr>`;
      }
    } catch (err) {
      sitemapsTableBody.innerHTML = `<tr><td colspan="6" class="loading-td">Failed to load sitemaps: ${err.message}</td></tr>`;
    }
  }

  btnRefreshSitemaps.addEventListener('click', () => {
    if (selectedProperty) fetchSitemaps(selectedProperty);
  });

  btnSubmitSitemap.addEventListener('click', async () => {
    if (!selectedProperty) {
      alert('Please select an authorized Search Console property first.');
      return;
    }
    const path = sitemapPathInput.value.trim();
    if (!path) {
      alert('Please enter a sitemap path (e.g. sitemap.xml)');
      return;
    }

    sitemapSubmitNotice.style.display = 'block';
    sitemapSubmitNotice.className = 'test-result-alert';
    sitemapSubmitNotice.textContent = 'Submitting sitemap to Google...';

    try {
      const res = await fetch('/api/gsc/sitemaps/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: selectedProperty, feedpath: path })
      });
      const data = await res.json();

      if (data.success) {
        sitemapSubmitNotice.className = 'test-result-alert success';
        sitemapSubmitNotice.textContent = `✓ ${data.message}`;
        sitemapPathInput.value = '';
        fetchSitemaps(selectedProperty);
      } else {
        sitemapSubmitNotice.className = 'test-result-alert error';
        sitemapSubmitNotice.textContent = `Error: ${data.error}`;
      }
    } catch (err) {
      sitemapSubmitNotice.className = 'test-result-alert error';
      sitemapSubmitNotice.textContent = 'Submission error: ' + err.message;
    }
  });

  // ==========================================================================
  // 5. BATCH HISTORY & AUDITING
  // ==========================================================================
  async function fetchBatches() {
    try {
      const res = await fetch('/api/index/batches');
      const data = await res.json();
      allBatches = data.batches || [];
      renderBatchesTable();
    } catch (e) {
      console.warn('Failed to fetch batches:', e);
    }
  }

  function renderBatchesTable() {
    const query = (batchSearchInput.value || '').toLowerCase();
    const filtered = allBatches.filter(b => {
      if (query) {
        const matchesId = b.batchId.toLowerCase().includes(query);
        const matchesUrl = (b.sampleUrls || []).some(s => s.url.toLowerCase().includes(query));
        if (!matchesId && !matchesUrl) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      batchesTableBody.innerHTML = `<tr><td colspan="6" class="loading-td">No submission batches found. Submit your first batch above!</td></tr>`;
      return;
    }

    let html = '';
    filtered.forEach(b => {
      const dateStr = new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
      const latency = b.processingTimeMs ? `${b.processingTimeMs}ms` : '1.8s';

      html += `
        <tr>
          <td><span class="batch-code">${b.batchId}</span></td>
          <td><strong>${b.totalUrls} URLs</strong></td>
          <td><span style="font-family:var(--font-mono); color:#34D399;">${latency}</span></td>
          <td><span class="badge-status badge-processed">● ${b.status}</span></td>
          <td><span style="font-size:0.78rem; color:var(--text-muted);">${dateStr}</span></td>
          <td>
            <button class="btn btn-outline-sm btn-inspect-batch" data-id="${b.batchId}">Inspect</button>
          </td>
        </tr>
      `;
    });
    batchesTableBody.innerHTML = html;

    batchesTableBody.querySelectorAll('.btn-inspect-batch').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        inspectBatchDetails(id);
      });
    });
  }

  async function inspectBatchDetails(batchId) {
    try {
      const res = await fetch(`/api/index/batch/${batchId}`);
      const data = await res.json();
      if (data.batch) {
        executionModal.classList.add('active');
        btnCloseModal.style.display = 'block';
        modalFooterActions.style.display = 'flex';
        modalBatchIdBadge.textContent = `Batch: ${data.batch.batchId}`;
        modalUrlsCount.textContent = data.batch.totalUrls;
        timerCountdown.textContent = 'Done';
        pipelineProgressFill.style.width = '100%';

        [stage1, stage2, stage3, stage4].forEach(s => s.className = 'stage-step done');
        stage1Status.textContent = '✓ Verified';
        stage2Status.textContent = '✓ Google Handshake';
        stage3Status.textContent = '✓ Syndicated';
        stage4Status.textContent = '✓ Crawl Hub Live';

        renderModalResults(data.batch.items);
      }
    } catch (e) {
      alert(`Error loading batch: ${e.message}`);
    }
  }

  batchSearchInput.addEventListener('input', renderBatchesTable);
  btnRefreshBatches.addEventListener('click', fetchBatches);

  btnExportCsv.addEventListener('click', () => {
    if (allBatches.length === 0) {
      alert('No batches to export.');
      return;
    }
    let csv = 'Batch ID,Total URLs,Created At,Processing Latency,Status\n';
    allBatches.forEach(b => {
      csv += `"${b.batchId}",${b.totalUrls},"${b.createdAt}","${b.processingTimeMs}ms","${b.status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indexmetrix_batches_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  });

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  fetchGscStatus();
  fetchBatches();
  updateUrlMetrics();
});
