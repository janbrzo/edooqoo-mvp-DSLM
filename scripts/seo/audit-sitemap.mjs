#!/usr/bin/env node
/**
 * Sitemap Audit Script — reusable SEO diagnostic tool.
 *
 * USE WHEN:
 *   - Google Search Console reports "Discovered – currently not indexed",
 *     "Page with redirect", "Soft 404", "Not found (404)", or
 *     "Alternate page with proper canonical tag" issues.
 *   - You need to verify every URL in sitemap.xml returns 200, has the
 *     correct canonical tag, no unintended redirects, and is not flagged
 *     as noindex.
 *   - Before / after deploying a batch of new SEO landing pages.
 *
 * USAGE:
 *   node scripts/seo/audit-sitemap.mjs <sitemap-url> [--out=path.csv] [--concurrency=10]
 *
 * EXAMPLES:
 *   node scripts/seo/audit-sitemap.mjs https://edooqoo.com/sitemap.xml
 *   node scripts/seo/audit-sitemap.mjs https://edooqoo.com/sitemap.xml --out=/tmp/audit.csv --concurrency=20
 *
 * OUTPUT:
 *   CSV with columns: url, final_url, status, redirect_chain, canonical,
 *   canonical_matches, has_noindex, title, meta_description_len, h1_count,
 *   word_count, content_type, error
 *
 * CATEGORIES OF PROBLEMS DETECTED:
 *   - status >= 400  → "Not found (404)" / server error
 *   - status 3xx     → "Page with redirect" (logs full chain)
 *   - canonical_matches=false → "Alternate page with proper canonical tag"
 *   - has_noindex=true        → page deliberately excluded from index
 *   - word_count < 200        → thin content (likely "Discovered – not indexed")
 *   - missing title / meta description → SEO basics missing
 *
 * RAG KEYWORDS: sitemap audit, GSC indexing, soft 404, redirect chain,
 *   canonical mismatch, thin content, noindex, crawl budget, edooqoo seo,
 *   "Strona wykryta", "Strona zawiera przekierowanie", "Pozorny błąd 404".
 *
 * RELATED DOCS: docs/seo/SITEMAP_AUDIT.md
 */

import fs from 'node:fs/promises';

const args = process.argv.slice(2);
const sitemapUrl = args.find((a) => !a.startsWith('--'));
const outArg = args.find((a) => a.startsWith('--out='));
const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
const outPath = outArg ? outArg.split('=')[1] : '/tmp/sitemap-audit.csv';
const concurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1], 10) : 10;

if (!sitemapUrl) {
  console.error('Usage: node scripts/seo/audit-sitemap.mjs <sitemap-url> [--out=path.csv] [--concurrency=10]');
  process.exit(1);
}

const UA = 'EdooqooSitemapAudit/1.0 (+https://edooqoo.com)';

/** Fetch sitemap.xml and return list of <loc> URLs. Handles sitemap index recursively. */
async function loadSitemap(url, depth = 0) {
  if (depth > 3) return [];
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Failed to fetch sitemap ${url}: ${res.status}`);
  const xml = await res.text();

  // Sitemap index → recurse
  if (/<sitemapindex/i.test(xml)) {
    const childUrls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1]);
    const lists = await Promise.all(childUrls.map((u) => loadSitemap(u, depth + 1)));
    return lists.flat();
  }

  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1]);
}

/** Audit a single URL: follow redirects manually so we can record the chain. */
async function auditUrl(url) {
  const row = {
    url,
    final_url: '',
    status: 0,
    redirect_chain: '',
    canonical: '',
    canonical_matches: '',
    has_noindex: '',
    title: '',
    meta_description_len: 0,
    h1_count: 0,
    word_count: 0,
    content_type: '',
    error: '',
  };

  const chain = [];
  let currentUrl = url;
  let hops = 0;

  try {
    while (hops++ < 10) {
      const res = await fetch(currentUrl, {
        headers: { 'User-Agent': UA },
        redirect: 'manual',
      });
      row.status = res.status;
      row.content_type = res.headers.get('content-type') || '';

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) break;
        const next = new URL(loc, currentUrl).toString();
        chain.push(`${res.status}→${next}`);
        currentUrl = next;
        continue;
      }

      row.final_url = currentUrl;
      row.redirect_chain = chain.join(' | ');

      if (res.ok && /text\/html/i.test(row.content_type)) {
        const html = await res.text();

        const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        row.title = titleMatch ? titleMatch[1].trim().slice(0, 200) : '';

        const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
        row.meta_description_len = descMatch ? descMatch[1].length : 0;

        const canonMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
        row.canonical = canonMatch ? canonMatch[1] : '';
        if (row.canonical) {
          try {
            const canonAbs = new URL(row.canonical, currentUrl).toString().replace(/\/$/, '');
            const finalAbs = currentUrl.replace(/\/$/, '');
            row.canonical_matches = canonAbs === finalAbs ? 'true' : 'false';
          } catch {
            row.canonical_matches = 'invalid';
          }
        }

        const robotsMatch = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i);
        row.has_noindex = robotsMatch && /noindex/i.test(robotsMatch[1]) ? 'true' : 'false';

        row.h1_count = (html.match(/<h1[\s>]/gi) || []).length;

        // Strip tags + count words (rough, but enough to flag thin content)
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ');
        row.word_count = text.split(' ').filter(Boolean).length;
      }
      break;
    }
  } catch (err) {
    row.error = err instanceof Error ? err.message : String(err);
  }

  return row;
}

/** Bounded-concurrency map. */
async function pmap(items, fn, limit) {
  const results = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx], idx);
      if ((idx + 1) % 25 === 0) console.error(`[${idx + 1}/${items.length}] audited`);
    }
  });
  await Promise.all(workers);
  return results;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function summarize(rows) {
  const buckets = {
    ok: 0,
    redirect: 0,
    not_found: 0,
    server_error: 0,
    fetch_error: 0,
    canonical_mismatch: 0,
    noindex: 0,
    thin_content: 0,
  };
  for (const r of rows) {
    if (r.error) buckets.fetch_error++;
    else if (r.status >= 500) buckets.server_error++;
    else if (r.status === 404) buckets.not_found++;
    else if (r.redirect_chain) buckets.redirect++;
    else if (r.status >= 200 && r.status < 300) buckets.ok++;
    if (r.canonical_matches === 'false') buckets.canonical_mismatch++;
    if (r.has_noindex === 'true') buckets.noindex++;
    if (r.word_count > 0 && r.word_count < 200) buckets.thin_content++;
  }
  return buckets;
}

(async () => {
  console.error(`Loading sitemap: ${sitemapUrl}`);
  const urls = await loadSitemap(sitemapUrl);
  console.error(`Found ${urls.length} URLs. Auditing with concurrency=${concurrency}…`);

  const rows = await pmap(urls, auditUrl, concurrency);

  const headers = [
    'url', 'final_url', 'status', 'redirect_chain', 'canonical',
    'canonical_matches', 'has_noindex', 'title', 'meta_description_len',
    'h1_count', 'word_count', 'content_type', 'error',
  ];
  const csv = [headers.join(',')]
    .concat(rows.map((r) => headers.map((h) => csvEscape(r[h])).join(',')))
    .join('\n');

  await fs.writeFile(outPath, csv, 'utf8');

  const summary = summarize(rows);
  console.error('\n=== AUDIT SUMMARY ===');
  for (const [k, v] of Object.entries(summary)) console.error(`  ${k.padEnd(22)} ${v}`);
  console.error(`\nCSV written to: ${outPath}`);
})();