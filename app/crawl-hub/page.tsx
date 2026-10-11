import { Metadata } from 'next';
import { getBatches } from '@/lib/storage';

export const metadata: Metadata = {
  title: 'Googlebot High-Speed Crawl Gateway | Index Metrix Hub',
  description: 'Instant URL syndication and crawl acceleration hub for search crawlers.',
  robots: {
    index: true,
    follow: true,
  },
};

export const dynamic = 'force-dynamic';

export default function CrawlHubPage() {
  const batches = getBatches();
  const allUrls: any[] = [];
  batches.slice(0, 10).forEach(b => {
    (b.items || []).forEach(item => {
      if (allUrls.length < 500) allUrls.push(item);
    });
  });

  return (
    <main style={{ fontFamily: '-apple-system, sans-serif', background: '#0b0f17', color: '#e2e8f0', minHeight: '100vh', padding: '2rem' }}>
      <h1 style={{ color: '#818cf8', fontSize: '1.8rem', marginBottom: '0.5rem' }}>Googlebot High-Speed Crawl Gateway</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Fresh URLs queued for Googlebot discovery ({allUrls.length} links listed):
      </p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {allUrls.length === 0 ? (
          <li style={{ padding: '12px', background: '#1e293b', borderRadius: '6px', color: '#64748b' }}>
            No URLs queued yet. Submit URLs through Index Metrix bulk submitter.
          </li>
        ) : (
          allUrls.map((item, idx) => (
            <li
              key={idx}
              style={{
                padding: '10px 14px',
                background: '#1e293b',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <a
                href={item.url}
                rel="bookmark"
                target="_blank"
                style={{ color: '#38bdf8', textDecoration: 'none', wordBreak: 'break-all', fontSize: '0.9rem' }}
              >
                {item.url}
              </a>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: '#374151',
                    color: '#e5e7eb',
                  }}
                >
                  {item.category?.label || 'Link'}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '99px',
                    background: '#065f46',
                    color: '#6ee7b7',
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
