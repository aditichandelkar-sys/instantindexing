import assert from 'assert';
import { isPrivateOrReservedIp, resolveSafeIp, analyzeUrl } from '../lib/url-analyzer';
import { normalizeUrl, parseSitemapXml, parseRssXml, parseCsvUrls } from '../lib/url-importer';
import { processIndexingBatch } from '../lib/indexing-engine';
import { getBatches } from '../lib/storage';
import { urlBelongsToProperty } from '../lib/gsc-auth';

async function runTests() {
  console.log('======================================================');
  console.log('INDEX METRIX AUTOMATED PIPELINE & SECURITY TEST SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void> | void) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. SSRF IP Filter
  await test('SSRF Defense: Blocks Loopback & Private IPv4 and IPv6', () => {
    assert.strictEqual(isPrivateOrReservedIp('127.0.0.1'), true, 'Should block loopback 127.0.0.1');
    assert.strictEqual(isPrivateOrReservedIp('127.0.0.2'), true, 'Should block loopback 127.0.0.2');
    assert.strictEqual(isPrivateOrReservedIp('10.0.0.1'), true, 'Should block private 10.x.x.x');
    assert.strictEqual(isPrivateOrReservedIp('172.16.0.1'), true, 'Should block private 172.16.x.x');
    assert.strictEqual(isPrivateOrReservedIp('192.168.1.1'), true, 'Should block private 192.168.x.x');
    assert.strictEqual(isPrivateOrReservedIp('169.254.169.254'), true, 'Should block AWS/GCP cloud metadata IP');
    assert.strictEqual(isPrivateOrReservedIp('0.0.0.0'), true, 'Should block 0.0.0.0');
    assert.strictEqual(isPrivateOrReservedIp('::1'), true, 'Should block IPv6 loopback');
    assert.strictEqual(isPrivateOrReservedIp('fc00::1'), true, 'Should block IPv6 unique local');
    assert.strictEqual(isPrivateOrReservedIp('8.8.8.8'), false, 'Should allow public IP 8.8.8.8');
    assert.strictEqual(isPrivateOrReservedIp('142.250.190.46'), false, 'Should allow public Google IP');
  });

  // 2. Hostname SSRF Resolution
  await test('SSRF Defense: Rejects Local & Cloud Metadata Hostnames', async () => {
    let rejectedLocal = false;
    try {
      await resolveSafeIp('localhost');
    } catch {
      rejectedLocal = true;
    }
    assert.strictEqual(rejectedLocal, true, 'Should reject localhost');

    let rejectedMeta = false;
    try {
      await resolveSafeIp('metadata.google.internal');
    } catch {
      rejectedMeta = true;
    }
    assert.strictEqual(rejectedMeta, true, 'Should reject metadata.google.internal');
  });

  // 3. Normalization & Deduplication
  await test('URL Normalizer: Lowercases Host, Strips Fragments, Ensures Protocol', () => {
    const norm1 = normalizeUrl('HTTPS://Example.COM/Path/To/Page#section1');
    assert.strictEqual(norm1, 'https://example.com/Path/To/Page', 'Hostname should be lowercased and hash stripped');

    const norm2 = normalizeUrl('example.org/test?id=123&sort=asc');
    assert.strictEqual(norm2, 'https://example.org/test?id=123&sort=asc', 'Protocol should default to https:// and query params preserved');

    assert.strictEqual(normalizeUrl('javascript:alert(1)'), null, 'Should reject javascript: scheme');
    assert.strictEqual(normalizeUrl('invalid-no-dot'), null, 'Should reject invalid domain without dot');
  });

  // 4. Sitemap XML Parser
  await test('XML Sitemap Parser: Extracts all valid <loc> elements', () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/page-1</loc>
    <lastmod>2026-01-01</lastmod>
  </url>
  <url>
    <loc>https://example.com/page-2</loc>
  </url>
  <url>
    <loc>https://example.com/page-1</loc> <!-- Duplicate -->
  </url>
</urlset>`;

    const extracted = parseSitemapXml(sampleXml);
    assert.strictEqual(extracted.length, 2, 'Should extract 2 unique URLs');
    assert.deepStrictEqual(extracted, ['https://example.com/page-1', 'https://example.com/page-2']);
  });

  // 5. RSS Feed Parser
  await test('RSS / Atom Feed Parser: Extracts <link> elements', () => {
    const sampleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sample Feed</title>
    <item>
      <title>Article 1</title>
      <link>https://example.com/article-1</link>
    </item>
    <item>
      <title>Article 2</title>
      <link>https://example.com/article-2</link>
    </item>
  </channel>
</rss>`;

    const extracted = parseRssXml(sampleRss);
    assert.strictEqual(extracted.length, 2, 'Should extract 2 URLs from RSS');
    assert.strictEqual(extracted[0], 'https://example.com/article-1');
  });

  // 6. CSV URL Parser
  await test('CSV URL Parser: Extracts URLs from multi-column rows', () => {
    const csvData = `"Title","URL","Date"\n"Post 1","https://example.com/post-1","2026-01-01"\n"Post 2","https://example.com/post-2","2026-01-02"`;
    const extracted = parseCsvUrls(csvData);
    assert.strictEqual(extracted.length, 2, 'Should extract 2 URLs from CSV');
    assert.strictEqual(extracted[0], 'https://example.com/post-1');
  });

  // 7. Mode A: GSC Property Verification
  await test('Mode A: Checks Domain & Prefix Match for Search Console Properties', () => {
    assert.strictEqual(urlBelongsToProperty('https://example.com/about', 'sc-domain:example.com'), true);
    assert.strictEqual(urlBelongsToProperty('https://blog.example.com/post', 'sc-domain:example.com'), true);
    assert.strictEqual(urlBelongsToProperty('https://other.com/post', 'sc-domain:example.com'), false);
    assert.strictEqual(urlBelongsToProperty('https://example.com/blog/1', 'https://example.com/blog/'), true);
    assert.strictEqual(urlBelongsToProperty('https://example.com/shop/1', 'https://example.com/blog/'), false);
  });

  // 8. SSRF Probing via Technical Analyzer
  await test('URL Analyzer: Blocks SSRF Target Before Network Request', async () => {
    const res = await analyzeUrl('http://169.254.169.254/latest/meta-data/');
    assert.strictEqual(res.isIndexable, false);
    assert.strictEqual(res.verdict, 'ssrf_blocked');
    assert.strictEqual(res.statusCode, 0);
  });

  // 9. Single & 2-URL Batch Submission Pipeline
  await test('Batch Submission Pipeline: Accepts 2 URLs, Stores in Authoritative Storage & Crawl Hub', async () => {
    const testUrls = [
      'https://example.com/pipeline-test-url-1',
      'https://example.com/pipeline-test-url-2'
    ];

    const batch = await processIndexingBatch(testUrls, { skipAnalysis: true });
    assert.ok(batch.batchId, 'Should generate batchId');
    assert.strictEqual(batch.totalUrls, 2, 'Should accept exactly 2 URLs');
    assert.strictEqual(batch.accepted, 2, 'Should have 2 accepted items');
    assert.strictEqual(batch.items[0].indexStatus, 'Unverified', 'Should truthfully report Unverified indexStatus');

    // Retrieve batches from storage
    const allBatches = await getBatches();
    const storedBatch = allBatches.find(b => b.batchId === batch.batchId);
    assert.ok(storedBatch, 'Batch should be retrieved from storage');
    assert.strictEqual(storedBatch.totalUrls, 2, 'Stored batch should retain 2 URLs');
  });

  // 10. Malformed URL Error Handling
  await test('Validation: Rejects Empty or Malformed Batch With Clear Error', async () => {
    let errorThrown = false;
    try {
      await processIndexingBatch(['not a url at all', 'invalid://scheme']);
    } catch (err: any) {
      errorThrown = true;
      assert.ok(err.message.includes('No valid HTTP or HTTPS URLs'), 'Error message should clearly explain validation failure');
    }
    assert.strictEqual(errorThrown, true, 'Should throw validation error');
  });

  console.log('\n======================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
