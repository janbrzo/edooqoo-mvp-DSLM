#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOINDEX_ROUTES, REDIRECTS } from '../../cloudflare/content-routing.generated.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_BASE = 'https://edooqoo.com';
const OUTPUT_JSON = path.join(ROOT, 'docs', 'seo', 'live-routing.generated.json');
const OUTPUT_MD = path.join(ROOT, 'docs', 'seo', 'live-routing.generated.md');

const argv = process.argv.slice(2);
const argValue = (name) => {
  const exactIndex = argv.indexOf(name);
  if (exactIndex >= 0) return argv[exactIndex + 1];
  const prefixed = argv.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : null;
};

const BASE = (argValue('--base') || process.env.EDOOQOO_LIVE_BASE || DEFAULT_BASE).replace(/\/+$/, '');
const SOFT = argv.includes('--soft');
const STRICT_HEADERS = argv.includes('--strict-headers');
const WRITE = !argv.includes('--no-write');
const LIMIT_REDIRECTS = Number(argValue('--redirect-limit') || process.env.EDOOQOO_LIVE_REDIRECT_LIMIT || 0);
const LIMIT_NOINDEX = Number(argValue('--noindex-limit') || process.env.EDOOQOO_LIVE_NOINDEX_LIMIT || 10);

function absolute(route, base = BASE) {
  return new URL(route, `${base}/`).toString();
}

function headerObject(headers) {
  return {
    location: headers.get('location') || '',
    xRobotsTag: headers.get('x-robots-tag') || '',
    contentType: headers.get('content-type') || '',
    cacheControl: headers.get('cache-control') || '',
    deploymentId: headers.get('x-deployment-id') || '',
    server: headers.get('server') || '',
  };
}

async function request(url) {
  try {
    let response = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (response.status === 405) {
      response = await fetch(url, { method: 'GET', redirect: 'manual' });
    }
    return {
      ok: true,
      status: response.status,
      headers: headerObject(response.headers),
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      status: 0,
      headers: {},
    };
  }
}

function sameTarget(actual, expected) {
  if (!actual) return false;
  try {
    const actualUrl = new URL(actual, BASE);
    const expectedUrl = new URL(expected, BASE);
    return actualUrl.hostname === expectedUrl.hostname &&
      actualUrl.pathname.replace(/\/+$/, '') === expectedUrl.pathname.replace(/\/+$/, '') &&
      actualUrl.protocol === expectedUrl.protocol;
  } catch {
    return false;
  }
}

/**
 * The production host (Lovable hosting) cannot emit 301s or X-Robots-Tag headers for static
 * files; the Cloudflare worker that would is not bound to edooqoo.com. Crawl-control signals are
 * therefore delivered in HTML (meta robots + canonical + meta refresh stub). This verifier accepts
 * that layer unless --strict-headers is passed (use it once the worker actually serves traffic).
 */
async function fetchHtml(url) {
  try {
    const response = await fetch(url, { redirect: 'manual' });
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  }
}

function htmlSignals(html) {
  const head = html.slice(0, 20000);
  const robots = (head.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i)
    || head.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']robots["']/i)
    || [])[1] || '';
  const canonical = (head.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1] || '';
  const refresh = (head.match(/<meta[^>]+http-equiv=["']refresh["'][^>]*content=["'][^"']*url=([^"']+)["']/i) || [])[1] || '';
  return { robots, canonical, refresh };
}

function selectedRedirects() {
  const rows = Object.entries(REDIRECTS)
    .filter(([route]) => route.startsWith('/blog/'))
    .sort(([a], [b]) => a.localeCompare(b));
  return LIMIT_REDIRECTS > 0 ? rows.slice(0, LIMIT_REDIRECTS) : rows;
}

function selectedNoindexRoutes() {
  return [...NOINDEX_ROUTES]
    .filter((route) =>
      route !== '/signup' &&
      !route.endsWith('.html') &&
      !route.startsWith('/newsletter/') &&
      (route.startsWith('/worksheets/') || route.startsWith('/esl-worksheets/') || route.startsWith('/english-for/'))
    )
    .sort((a, b) => a.localeCompare(b))
    .slice(0, LIMIT_NOINDEX);
}

async function classifyNoindex(url, result, secondDirective) {
  const header = result.headers?.xRobotsTag || '';
  if (result.status === 200 && /noindex/i.test(header) && secondDirective.test(header)) {
    return { outcome: 'pass-header-noindex', signals: null };
  }
  if (STRICT_HEADERS || result.status !== 200) return { outcome: 'fail-no-signal', signals: null };
  const signals = htmlSignals(await fetchHtml(url));
  const ok = /noindex/i.test(signals.robots) && secondDirective.test(signals.robots);
  return { outcome: ok ? 'pass-html-meta' : 'fail-no-signal', signals };
}

async function run() {
  const checks = [];

  for (const [from, to] of selectedRedirects()) {
    const url = absolute(from);
    const expected = absolute(to);
    const result = await request(url);
    let outcome = 'fail-no-signal';
    let signals = null;
    if (result.status === 301 && sameTarget(result.headers.location, expected)) {
      outcome = 'pass-header-301';
    } else if (!STRICT_HEADERS && result.status === 200) {
      signals = htmlSignals(await fetchHtml(url));
      const stub = /noindex/i.test(signals.robots)
        && sameTarget(signals.canonical, expected)
        && sameTarget(signals.refresh, expected);
      if (stub) outcome = 'pass-html-stub';
    }
    checks.push({
      type: 'legacy-redirect',
      url,
      expected,
      outcome,
      pass: outcome.startsWith('pass'),
      signals,
      ...result,
    });
  }

  const signupUrl = `${BASE}/signup?exerciseType=definition-match&topic=weather`;
  const signup = await request(signupUrl);
  // /signup is an app route with no prerendered HTML, so the only crawl-control signal that can
  // exist without the edge worker is the robots.txt Disallow rule.
  const robotsTxt = await fetchHtml(`${BASE}/robots.txt`);
  const signupDisallowed = /^\s*Disallow:\s*\/signup\s*$/mi.test(robotsTxt);
  const signupOutcome = await classifyNoindex(signupUrl, signup, /nofollow/i);
  if (!signupOutcome.outcome.startsWith('pass') && signupDisallowed && !STRICT_HEADERS) {
    signupOutcome.outcome = 'pass-robots-disallow';
  }
  checks.push({
    type: 'signup-noindex',
    url: signupUrl,
    expected: 'noindex, nofollow (header or meta)',
    outcome: signupOutcome.outcome,
    pass: signupOutcome.outcome.startsWith('pass'),
    signals: signupOutcome.signals,
    ...signup,
  });

  for (const route of selectedNoindexRoutes()) {
    const url = absolute(route);
    const result = await request(url);
    const classified = await classifyNoindex(url, result, /\bfollow\b/i);
    checks.push({
      type: 'public-noindex-follow',
      url,
      expected: 'noindex, follow (header or meta)',
      outcome: classified.outcome,
      pass: classified.outcome.startsWith('pass'),
      signals: classified.signals,
      ...result,
    });
  }

  // Checked on an HTML route: without the Cloudflare worker the www host cannot 301, but the
  // rendered canonical still consolidates the apex host for Google.
  const wwwUrl = 'https://www.edooqoo.com/';
  const www = await request(wwwUrl);
  let wwwOutcome = 'fail-no-signal';
  let wwwSignals = null;
  if (www.status === 301 && sameTarget(www.headers.location, `${BASE}/`)) {
    wwwOutcome = 'pass-header-301';
  } else if (!STRICT_HEADERS && www.status === 200) {
    wwwSignals = htmlSignals(await fetchHtml(wwwUrl));
    if (sameTarget(wwwSignals.canonical, `${BASE}/`)) wwwOutcome = 'pass-html-canonical';
  }
  checks.push({
    type: 'host-canonical',
    url: wwwUrl,
    expected: `${BASE}/`,
    outcome: wwwOutcome,
    pass: wwwOutcome.startsWith('pass'),
    signals: wwwSignals,
    ...www,
  });

  const httpUrl = 'http://edooqoo.com/llms.txt';
  const http = await request(httpUrl);
  checks.push({
    type: 'http-to-https',
    url: httpUrl,
    expected: `${BASE}/llms.txt`,
    outcome: http.status === 301 && sameTarget(http.headers.location, `${BASE}/llms.txt`) ? 'pass-header-301' : 'fail-no-signal',
    pass: http.status === 301 && sameTarget(http.headers.location, `${BASE}/llms.txt`),
    ...http,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    strictHeaders: STRICT_HEADERS,
    totals: {
      checks: checks.length,
      passed: checks.filter((check) => check.pass).length,
      failed: checks.filter((check) => !check.pass).length,
      byOutcome: checks.reduce((acc, check) => {
        const key = check.outcome || (check.pass ? 'pass-header-301' : 'fail-no-signal');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {}),
    },
    checks,
  };

  const markdown = [
    '# Live Routing Verification',
    '',
    `Generated: ${report.generatedAt}`,
    `Base: ${BASE}`,
    '',
    '## Summary',
    '',
    `- Checks: ${report.totals.checks}`,
    `- Passed: ${report.totals.passed}`,
    `- Failed (fail-no-signal): ${report.totals.failed}`,
    `- Strict header mode: ${STRICT_HEADERS ? 'on' : 'off (HTML signal layer accepted)'}`,
    '',
    '### Outcomes',
    '',
    ...Object.entries(report.totals.byOutcome).sort().map(([key, value]) => `- ${key}: ${value}`),
    '',
    '| Type | URL | Expected | Status | Outcome | Location | Robots signal |',
    '|---|---|---|---:|---|---|---|',
    ...checks.map((check) => `| ${check.type} | ${check.url} | ${check.expected || ''} | ${check.status} | ${check.outcome || (check.pass ? 'pass-header-301' : 'fail-no-signal')} | ${check.headers?.location || check.signals?.canonical || ''} | ${check.headers?.xRobotsTag || check.signals?.robots || ''} |`),
    '',
    '## Operating Rule',
    '',
    '- `pass-header-301` / `pass-header-noindex`: signal delivered by the edge layer (Cloudflare worker active).',
    '- `pass-html-stub` / `pass-html-meta`: signal delivered in HTML because the worker is not bound to edooqoo.com. Valid for Google, weaker than a 301.',
    '- `fail-no-signal`: no crawl-control signal at all in headers or HTML. These are the only real defects.',
    '- Run with `--strict-headers` only after the Cloudflare worker actually serves production traffic.',
    '- This report verifies production behavior; it does not prove Google has recrawled the URLs yet.',
    '',
  ].join('\n');

  if (WRITE) {
    await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
    await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await fs.writeFile(OUTPUT_MD, markdown, 'utf8');
  }

  console.log(
    `[live-routing] checks=${report.totals.checks} passed=${report.totals.passed} failed=${report.totals.failed} ` +
      Object.entries(report.totals.byOutcome).sort().map(([k, v]) => `${k}=${v}`).join(' '),
  );
  if (report.totals.failed > 0 && !SOFT) process.exit(1);
}

await run();
