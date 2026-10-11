'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface QueuedItem {
  url: string;
  trackingId?: string;
  category?: {
    type?: string;
    label?: string;
    icon?: string;
    color?: string;
  };
  status?: string;
  submittedAt?: string;
  batchId?: string;
}

interface Props {
  initialUrls: QueuedItem[];
  initialError: string | null;
}

export default function CrawlHubClient({ initialUrls, initialError }: Props) {
  const [urls, setUrls] = useState<QueuedItem[]>(initialUrls);
  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);

  async function handleRefresh() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/crawl-hub', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.success) {
        setUrls(data.urls || []);
        setLastRefreshed(new Date().toLocaleTimeString());
      } else {
        setError(data.error || 'Failed to refresh queued URLs from storage');
      }
    } catch (err: any) {
      setError(err.message || 'Network error while contacting crawl hub storage');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        background: '#0b0f17',
        color: '#e2e8f0',
        minHeight: '100vh',
        padding: '2rem',
        maxWidth: '1100px',
        margin: '0 auto',
      }}
    >
      {/* Top Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <Link
          href="/"
          style={{
            color: '#818cf8',
            textDecoration: 'none',
            fontSize: '0.875rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '6px 12px',
            background: 'rgba(129, 140, 248, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(129, 140, 248, 0.2)',
          }}
        >
          ← Back to Submitter Dashboard
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {lastRefreshed && (
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Refreshed at {lastRefreshed}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            id="refreshCrawlHubBtn"
            style={{
              background: isLoading ? '#374151' : '#4f46e5',
              color: '#ffffff',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '6px',
              fontSize: '0.85rem',
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.2s ease',
            }}
          >
            {isLoading ? 'Refreshing...' : '↻ Refresh Queue'}
          </button>
        </div>
      </div>

      {/* Page Title & Status */}
      <h1 style={{ color: '#818cf8', fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Googlebot High-Speed Crawl Gateway
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
        Fresh URLs queued for Googlebot discovery ({urls.length} links listed):
      </p>

      {/* Error State Banner */}
      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '6px',
            color: '#f87171',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span>
            ⚠️ <strong>Storage / API Error:</strong> {error}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* URL List */}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {urls.length === 0 && !error ? (
          <li
            id="emptyQueueNotice"
            style={{
              padding: '16px',
              background: '#1e293b',
              borderRadius: '6px',
              color: '#94a3b8',
              textAlign: 'center',
              border: '1px dashed #334155',
            }}
          >
            No URLs queued yet. Submit URLs through Index Metrix bulk submitter.
          </li>
        ) : (
          urls.map((item, idx) => (
            <li
              key={item.url + '_' + idx}
              style={{
                padding: '12px 16px',
                background: '#1e293b',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '75%' }}>
                <a
                  href={item.url}
                  rel="bookmark"
                  target="_blank"
                  style={{
                    color: '#38bdf8',
                    textDecoration: 'none',
                    wordBreak: 'break-all',
                    fontSize: '0.92rem',
                    fontWeight: 500,
                  }}
                >
                  {item.url}
                </a>
                {item.submittedAt && (
                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    Submitted: {new Date(item.submittedAt).toLocaleString()}
                    {item.batchId ? ` · ${item.batchId}` : ''}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 9px',
                    borderRadius: '99px',
                    background: item.category?.color ? `${item.category.color}22` : '#374151',
                    color: item.category?.color || '#e5e7eb',
                    border: item.category?.color ? `1px solid ${item.category.color}44` : 'none',
                  }}
                >
                  {item.category?.icon ? `${item.category.icon} ` : ''}
                  {item.category?.label || 'Link'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '3px 9px',
                    borderRadius: '99px',
                    background: '#065f46',
                    color: '#6ee7b7',
                    fontWeight: 500,
                  }}
                >
                  ● Queued
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}
