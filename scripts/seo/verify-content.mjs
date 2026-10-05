#!/usr/bin/env node
/**
 * verify-content.mjs — automated content verification (operator-run, not part of build:seo).
 *
 *   npm run seo:audit-uniqueness                      # layer 1 needs this measurement
 *   npm run seo:verify-content -- --routes=/blog/x.html,/tools/y
 *   npm run seo:verify-content -- --routes=... --links      # also check external citations
 *   npm run seo:verify-content -- --routes=... --llm        # also run the two LLM judges
 *   npm run seo:verify-content -- --routes=... --llm --competitors=path/to/competitors.json
 *
 * Writes/merges docs/seo/content-verification.generated.json keyed by route. The record stores a
 * hash of the visible text, so any later edit makes the record stale (see audit-content-verification).
 * The --llm flag needs Anthropic credentials (ANTHROPIC_API_KEY or an `ant auth login` profile)
 * and spends real money: roughly one cached system prompt plus one page per judge per route.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildRecord,
  checkExternalLinks,
  deterministicChecks,
  extractPage,
} from './lib/content-verification.mjs';
import { runJudges } from './lib/llm-judges.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PUBLIC = path.join(ROOT, 'public');
const UNIQUENESS = path.join(ROOT, 'docs/seo/content-uniqueness.generated.json');
const RECORDS = path.join(ROOT, 'docs/seo/content-verification.generated.json');
const PRODUCT_FACTS = path.join(ROOT, 'docs/llm-context.md');

/** Hostnames (and their subdomains) a verified page may cite. First-party and scholarly sources only. */
export const CITATION_ALLOWLIST = [
  'coe.int', 'cambridge.org', 'cambridgeenglish.org', 'britishcouncil.org', 'teachingenglish.org.uk',
  'oup.com', 'ets.org', 'ielts.org', 'unesco.org', 'ncbi.nlm.nih.gov', 'doi.org', 'jstor.org',
  'tandfonline.com', 'sagepub.com', 'wiley.com', 'springer.com', 'victoria.ac.nz', 'kcl.ac.uk',
  'ac.uk', 'edu',
];

const args = process.argv.slice(2);
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const flag = (name) => args.includes(`--${name}`);

function resolveFile(route) {
  const rel = route.replace(/^\//, '');
  return [path.join(PUBLIC, rel), path.join(PUBLIC, `${rel}.html`), path.join(PUBLIC, rel, 'index.html')]
    .find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
}

async function fetchWithTimeout(url) {
  const attempt = async (method) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      return await fetch(url, { method, redirect: 'follow', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
  const head = await attempt('HEAD');
  return head.ok ? head : attempt('GET');
}

async function main() {
  const routes = (arg('routes') || '').split(',').map((r) => r.trim()).filter(Boolean);
  if (!routes.length) {
    console.error('Pass --routes=/a,/b (explicit on purpose: --llm spends money).');
    process.exit(2);
  }
  if (!fs.existsSync(UNIQUENESS)) {
    console.error('Run npm run seo:audit-uniqueness first (layer 1 needs the uniqueness measurement).');
    process.exit(2);
  }
  const uniqueness = new Map(JSON.parse(fs.readFileSync(UNIQUENESS, 'utf8')).rows.map((row) => [row.route, row]));
  const competitors = arg('competitors') ? JSON.parse(fs.readFileSync(arg('competitors'), 'utf8')) : {};

  let client = null;
  let productFacts = '';
  if (flag('llm')) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic(); // resolves ANTHROPIC_API_KEY or an `ant auth login` profile
    productFacts = fs.readFileSync(PRODUCT_FACTS, 'utf8');
  }

  const existing = fs.existsSync(RECORDS) ? JSON.parse(fs.readFileSync(RECORDS, 'utf8')) : { schemaVersion: 1, records: [] };
  const byRoute = new Map(existing.records.map((record) => [record.route, record]));

  for (const route of routes) {
    const file = resolveFile(route);
    if (!file) {
      console.error(`[verify-content] ${route}: no static HTML under public/ (SPA-only routes need a prerendered snapshot)`);
      process.exitCode = 1;
      continue;
    }
    const page = extractPage(fs.readFileSync(file, 'utf8'));
    const row = uniqueness.get(route);
    const layer1 = deterministicChecks(page, { maxContainment: row?.maxContainment, nearest: row?.nearest });
    const links = flag('links')
      ? await checkExternalLinks(page.externalLinks, { allowlist: CITATION_ALLOWLIST, fetchImpl: fetchWithTimeout })
      : null;
    const layer1Failed = layer1.some((check) => check.status === 'fail');
    // Do not spend model calls on a page that already fails the deterministic layer.
    const layer2 = client && !layer1Failed
      ? await runJudges({ client, productFacts, route, page, competitors: competitors[route] || [] })
      : null;
    const record = buildRecord({ route, page, layer1, links, layer2, checkedAt: new Date().toISOString() });
    byRoute.set(route, record);
    const failing = record.layer1.checks.filter((c) => c.status === 'fail').map((c) => `${c.id}: ${c.detail}`);
    console.log(`[verify-content] ${route}: ${record.status}${failing.length ? `\n   - ${failing.join('\n   - ')}` : ''}`);
    for (const judge of layer2?.judges || []) {
      if (!judge.pass) console.log(`   ${judge.id} (${judge.model}) failed:\n     - ${judge.failReasons.join('\n     - ')}`);
    }
  }

  const records = [...byRoute.values()].sort((a, b) => a.route.localeCompare(b.route));
  fs.writeFileSync(RECORDS, `${JSON.stringify({ schemaVersion: 1, records }, null, 2)}\n`);
  console.log(`[verify-content] wrote ${path.relative(ROOT, RECORDS)} (${records.length} records)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
