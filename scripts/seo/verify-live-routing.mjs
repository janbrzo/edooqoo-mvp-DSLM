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

async function run() {
  const checks = [];

  for (const [from, to] of selectedRedirects()) {
    const url = absolute(from);
    const expected = absolute(to);
    const result = await request(url);
    const pass = result.status === 301 && sameTarget(result.headers.location, expected);
    checks.push({
      type: 'legacy-redirect',
      url,
      expected,
      pass,
      ...result,
    });
  }

  const signupUrl = `${BASE}/signup?exerciseType=definition-match&topic=weather`;
  const signup = await request(signupUrl);
  checks.push({
    type: 'signup-noindex',
    url: signupUrl,
    expected: 'X-Robots-Tag: noindex, nofollow',
    pass: signup.status === 200 && /noindex/i.test(signup.headers.xRobotsTag || '') && /nofollow/i.test(signup.headers.xRobotsTag || ''),
    ...signup,
  });

  for (const route of selectedNoindexRoutes()) {
    const url = absolute(route);
    const result = await request(url);
    checks.push({
      type: 'public-noindex-follow',
      url,
      expected: 'X-Robots-Tag: noindex, follow',
      pass: result.status === 200 && /noindex/i.test(result.headers.xRobotsTag || '') && /follow/i.test(result.headers.xRobotsTag || ''),
      ...result,
    });
  }

  const wwwUrl = 'https://www.edooqoo.com/llms.txt';
  const www = await request(wwwUrl);
  checks.push({
    type: 'host-canonical',
    url: wwwUrl,
    expected: `${BASE}/llms.txt`,
    pass: www.status === 301 && sameTarget(www.headers.location, `${BASE}/llms.txt`),
    ...www,
  });

  const httpUrl = 'http://edooqoo.com/llms.txt';
  const http = await request(httpUrl);
  checks.push({
    type: 'http-to-https',
    url: httpUrl,
    expected: `${BASE}/llms.txt`,
    pass: http.status === 301 && sameTarget(http.headers.location, `${BASE}/llms.txt`),
    ...http,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    base: BASE,
    totals: {
      checks: checks.length,
      passed: checks.filter((check) => check.pass).length,
      failed: checks.filter((check) => !check.pass).length,
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
    `- Failed: ${report.totals.failed}`,
    '',
    '| Type | URL | Expected | Status | Location | X-Robots-Tag | Pass |',
    '|---|---|---|---:|---|---|---:|',
    ...checks.map((check) => `| ${check.type} | ${check.url} | ${check.expected || ''} | ${check.status} | ${check.headers?.location || ''} | ${check.headers?.xRobotsTag || ''} | ${check.pass ? 'yes' : 'no'} |`),
    '',
    '## Operating Rule',
    '',
    '- If legacy redirects fail live, fix production edge binding or host redirect rules before clicking another GSC validation cycle.',
    '- If signup or long-tail noindex headers fail live, Google may see weaker crawl-control signals unless the HTML meta fallback is present.',
    '- This report verifies production behavior; it does not prove Google has recrawled the URLs yet.',
    '',
  ].join('\n');

  if (WRITE) {
    await fs.mkdir(path.dirname(OUTPUT_JSON), { recursive: true });
    await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await fs.writeFile(OUTPUT_MD, markdown, 'utf8');
  }

  console.log(`[live-routing] checks=${report.totals.checks} passed=${report.totals.passed} failed=${report.totals.failed}`);
  if (report.totals.failed > 0 && !SOFT) process.exit(1);
}

await run();
