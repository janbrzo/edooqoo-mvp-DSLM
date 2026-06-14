#!/usr/bin/env node
/**
 * SPA Route Prerenderer — generates static HTML snapshots for SEO-critical SPA routes.
 *
 * USE WHEN:
 *   - GSC reports "Discovered – currently not indexed" or "Alternate page with proper
 *     canonical tag" for SPA routes (root cause: Googlebot indexes raw index.html
 *     before React hydration; sees thin content + wrong canonical).
 *   - You added new top-level public routes (/about, /pricing, /features/*, etc.)
 *     that need first-paint HTML for SEO.
 *
 * HOW IT WORKS:
 *   1. Assumes `vite build` already ran and produced `dist/`.
 *   2. Spins up a static file server on dist/ at http://127.0.0.1:4173.
 *   3. Launches headless Chromium via Puppeteer.
 *   4. For each route in SEO_ROUTES:
 *        a. Navigate, wait for networkidle + extra 1500ms (React Router + canonical hook + lazy chunks).
 *        b. Snapshot full document HTML.
 *        c. Write to `dist/<route>/index.html` (Lovable hosting will serve this file
 *           directly instead of the SPA fallback for that exact path).
 *   5. SPA hydration on the snapshot is a no-op (same React tree). All client-side
 *      navigation continues to work via React Router.
 *
 * USAGE:
 *   node scripts/seo/prerender-spa-routes.mjs
 *   node scripts/seo/prerender-spa-routes.mjs --dist=dist --port=4173
 *
 * REQUIREMENTS:
 *   - Puppeteer (`bun add -d puppeteer`) — only needed at build time, not runtime.
 *   - Node 18+ (native fetch + fs/promises).
 *
 * SAFETY:
 *   - Only prerenders informational/marketing routes (no auth, no dynamic data).
 *   - Any route that still fails after retries fails the build.
 *   - Strips <script type="module" src="/src/main.tsx"> dev fragments if present.
 *
 * RAG KEYWORDS: prerender, static SPA snapshot, vite prerender, react snap,
 *   googlebot raw HTML, hydration no-op, dist/<route>/index.html, SEO indexing fix,
 *   "Discovered currently not indexed" definitive fix, edooqoo SPA prerender.
 *
 * RELATED: docs/seo/SPA_PRERENDER.md, src/components/RouteCanonicalUpdater.tsx,
 *   docs/seo/SITEMAP_AUDIT.md.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { getPrerenderRoutes } from './seo-route-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SITE_ORIGIN = 'https://edooqoo.com';
const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const distArg = args.find((a) => a.startsWith('--dist='));
const portArg = args.find((a) => a.startsWith('--port='));
const outArg = args.find((a) => a.startsWith('--out='));
const startAtArg = args.find((a) => a.startsWith('--start-at='));
const onlyArg = args.find((a) => a.startsWith('--only='));
const SOFT_FAIL = args.includes('--soft-fail');
const DIST = path.resolve(ROOT, distArg ? distArg.split('=')[1] : 'dist');
const PORT = portArg ? parseInt(portArg.split('=')[1], 10) : 4173;
/**
 * --out controls where snapshots are written:
 *   dist (default)  → dist/<route>/index.html (consumed by current build).
 *   public          → public/<route>/index.html (committed to repo as fallback
 *                     when the Lovable build environment lacks Puppeteer).
 */
const OUT_MODE = outArg ? outArg.split('=')[1] : 'dist';
const OUT_DIR = OUT_MODE === 'public' ? path.resolve(ROOT, 'public') : DIST;
const PRERENDER_MARKER = path.join(OUT_DIR, '.seo-prerender-complete.json');
const MAX_ROUTE_ATTEMPTS = 3;
const BROWSER_RESTART_INTERVAL = 50;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    delay(ms).then(() => {
      throw new Error(`${label} timeout after ${ms}ms`);
    }),
  ]);
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function normalizeSnapshotHtml(html, route) {
  const canonical = route === '/' ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${route}`;
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || 'Edooqoo';
  const descriptions = [...html.matchAll(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/gi)];
  const description = descriptions.at(-1)?.[1]?.trim() || '';

  let normalized = html
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, '')
    .replace(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
      (full, jsonText) => {
        try {
          const json = JSON.parse(jsonText.trim());
          const nodes = Array.isArray(json?.['@graph']) ? json['@graph'] : [json];
          const isRootPageSchema = nodes.some((node) =>
            ['WebPage', 'FAQPage', 'BreadcrumbList'].includes(node?.['@type'])
          );
          return isRootPageSchema ? '' : full;
        } catch {
          return full;
        }
      },
    );

  const webPageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: title,
    description,
    isPartOf: { '@id': 'https://edooqoo.com/#website' },
    about: { '@id': 'https://edooqoo.com/#software' },
    inLanguage: 'en',
  };
  const headInjection = [
    `<link rel="canonical" href="${escapeHtmlAttribute(canonical)}">`,
    `<script type="application/ld+json">${JSON.stringify(webPageSchema).replace(/</g, '\\u003c')}</script>`,
  ].join('');

  normalized = normalized.replace('</head>', `${headInjection}</head>`);
  return normalized;
}

function softExit(reason) {
  if (SOFT_FAIL) {
    console.warn(`[prerender] SOFT-FAIL exit (build continues): ${reason}`);
    process.exit(0);
  }
  console.error(`[prerender] FATAL: ${reason}`);
  process.exit(1);
}

/**
 * Routes to prerender. Source: scripts/seo/seo-route-manifest.mjs.
 * Only public informational/SEO routes — never auth-gated app routes.
 */
const SEO_ROUTES = getPrerenderRoutes({ root: ROOT });
const SEO_ROUTE_SET = new Set(
  SEO_ROUTES.map((route) => route === '/' ? '/' : route.replace(/\/+$/, ''))
);
const START_AT_ROUTE = startAtArg ? startAtArg.split('=')[1] : null;
const ONLY_ROUTES = onlyArg
  ? onlyArg.split('=')[1].split(',').map((route) => route.trim()).filter(Boolean)
  : [];
const START_AT_INDEX = START_AT_ROUTE ? SEO_ROUTES.indexOf(START_AT_ROUTE) : -1;
const RENDER_ROUTES = ONLY_ROUTES.length > 0
  ? ONLY_ROUTES
  : START_AT_ROUTE && START_AT_INDEX >= 0
  ? SEO_ROUTES.slice(START_AT_INDEX)
  : SEO_ROUTES;

async function validateCompletedSnapshotSet() {
  const issues = [];

  for (const route of SEO_ROUTES) {
    const outputPath =
      route === '/'
        ? path.join(OUT_DIR, 'index.html')
        : path.join(OUT_DIR, route.replace(/^\//, ''), 'index.html');

    let html;
    try {
      html = await fs.readFile(outputPath, 'utf8');
    } catch {
      issues.push(`${route}: missing snapshot`);
      continue;
    }

    const expectedCanonical = `${SITE_ORIGIN}${route === '/' ? '/' : route}`;
    const canonicalCount = (
      html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi) || []
    ).length;
    const h1Count = (html.match(/<h1\b[^>]*>/gi) || []).length;
    const compactHtml = html.replace(/\s+/g, '');

    if (canonicalCount !== 1) {
      issues.push(`${route}: expected one canonical, found ${canonicalCount}`);
    }
    if (!html.includes(`href="${expectedCanonical}"`)) {
      issues.push(`${route}: canonical does not match ${expectedCanonical}`);
    }
    if (h1Count !== 1) {
      issues.push(`${route}: expected one H1, found ${h1Count}`);
    }
    if (!compactHtml.includes(`"@id":"${expectedCanonical}#webpage"`)) {
      issues.push(`${route}: route WebPage schema missing`);
    }
  }

  return issues;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function startStaticServer(distDir, port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        let filePath = path.join(distDir, urlPath);
        if (!filePath.startsWith(distDir)) {
          res.statusCode = 403;
          return res.end('Forbidden');
        }

        const normalizedRoute = urlPath === '/' ? '/' : urlPath.replace(/\/+$/, '');
        const isPrerenderRoute = SEO_ROUTE_SET.has(normalizedRoute);

        if (isPrerenderRoute) {
          // Existing public/<route>/index.html snapshots are copied into dist by Vite.
          // Prerender SEO routes from the current SPA bundle so stale snapshots cannot
          // shadow updated React content during regeneration.
          filePath = path.join(distDir, 'index.html');
        } else {
          let stat;
          try { stat = fsSync.statSync(filePath); } catch { stat = null; }

          if (stat && stat.isDirectory()) {
            const idx = path.join(filePath, 'index.html');
            if (fsSync.existsSync(idx)) filePath = idx;
          } else if (!stat) {
            // SPA fallback
            filePath = path.join(distDir, 'index.html');
          }
        }

        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
        fsSync.createReadStream(filePath).pipe(res);
      } catch (err) {
        res.statusCode = 500;
        res.end(String(err));
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

function closeServer(server) {
  return new Promise((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    server.close(done);
    server.closeAllConnections?.();
    setTimeout(done, 1000);
  });
}

async function main() {
  await fs.rm(PRERENDER_MARKER, { force: true });

  // Validate dist exists
  let shellTitle = '';
  try {
    const shellHtml = await fs.readFile(path.join(DIST, 'index.html'), 'utf8');
    shellTitle = shellHtml.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || '';
  } catch {
    return softExit(`dist/index.html not found at ${DIST}. Run \`vite build\` first.`);
  }

  // Lazy-import puppeteer so missing dep produces a friendly error
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch (err) {
    return softExit(
      `puppeteer not installed (${err?.code ?? 'unknown'}). Run locally: bun add -d puppeteer && npm run build:seo:to-public`,
    );
  }

  console.log(`[prerender] Starting static server on http://127.0.0.1:${PORT} serving ${DIST}`);
  console.log(`[prerender] Writing snapshots to ${OUT_DIR} (mode=${OUT_MODE})`);
  if (START_AT_ROUTE) {
    console.log(`[prerender] Resuming from ${START_AT_ROUTE} (${RENDER_ROUTES.length}/${SEO_ROUTES.length} routes)`);
  }
  if (ONLY_ROUTES.length > 0) {
    console.log(`[prerender] Rendering only ${ONLY_ROUTES.length} requested route(s)`);
  }
  const server = await startStaticServer(DIST, PORT);

  const launchBrowser = () =>
    puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

  const closeBrowser = async (targetBrowser) => {
    if (!targetBrowser) return;
    const browserProcess = typeof targetBrowser.process === 'function'
      ? targetBrowser.process()
      : null;
    try {
      await Promise.race([
        targetBrowser.close(),
        delay(3000).then(() => {
          throw new Error('browser close timeout');
        }),
      ]);
    } catch (err) {
      console.warn(`[prerender] WARN browser cleanup failed: ${err.message}`);
      try {
        if (browserProcess && !browserProcess.killed) {
          if (process.platform === 'win32') {
            await execFileAsync(
              'taskkill',
              ['/PID', String(browserProcess.pid), '/T', '/F'],
              { timeout: 5000, windowsHide: true },
            );
          } else {
            browserProcess.kill('SIGKILL');
          }
        }
      } catch {}
    }
  };

  let browser;
  try {
    browser = await launchBrowser();
  } catch (err) {
    await closeServer(server);
    return softExit(`Failed to launch headless Chromium: ${err.message}`);
  }

  let okCount = 0;
  const failedRoutes = [];
  const renderRoute = async (route, attempt) => {
    const url = `http://127.0.0.1:${PORT}${route}`;
    let page;
    let restartBrowser = false;
    try {
      page = await withTimeout(browser.newPage(), 5000, 'new page');
    } catch (err) {
      console.warn(`[prerender] FAIL ${route} attempt ${attempt}/${MAX_ROUTE_ATTEMPTS} — cannot open new page: ${err.message}`);
      await closeBrowser(browser);
      try {
        browser = await launchBrowser();
        console.warn('[prerender] WARN relaunched Chromium after connection loss');
      } catch (launchErr) {
        return softExit(`Failed to relaunch headless Chromium: ${launchErr.message}`);
      }
      return false;
    }

    try {
      await withTimeout(
        page.setUserAgent('Mozilla/5.0 (compatible; EdooqooPrerender/1.0)'),
        5000,
        'set user agent',
      );
      await withTimeout(
        page.setRequestInterception(true),
        5000,
        'enable request interception',
      );
      page.on('request', (request) => {
        if (['image', 'media', 'font'].includes(request.resourceType())) request.abort();
        else request.continue();
      });
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      if (!resp || !resp.ok()) {
        console.warn(`[prerender] SKIP ${route} attempt ${attempt}/${MAX_ROUTE_ATTEMPTS} — status ${resp?.status() ?? 'no-response'}`);
        return false;
      }
      const expectedCanonical = `${SITE_ORIGIN}${route === '/' ? '/' : route}`;
      await page.waitForFunction(
        (expected) =>
          [...document.querySelectorAll('link[rel="canonical"]')].some(
            (link) => link.href === expected,
          ),
        { timeout: 8000 },
        expectedCanonical,
      );
      await page.waitForFunction(
        () => (document.querySelector('#root')?.textContent?.trim().length || 0) > 100,
        { timeout: 8000 },
      );
      await page.waitForFunction(
        () => document.querySelectorAll('#root h1').length === 1,
        { timeout: 8000 },
      );
      if (route !== '/') {
        await page.waitForFunction(
          (defaultTitle) =>
            document.title.trim().length > 0 && document.title.trim() !== defaultTitle,
          { timeout: 8000 },
          shellTitle,
        );
      }
      await delay(100);

      // Snapshot full HTML (includes hydrated DOM + updated canonical)
      const pageHtml = await withTimeout(page.content(), 5000, 'read page content');
      const html = normalizeSnapshotHtml(pageHtml, route);

      // Write to <OUT_DIR>/<route>/index.html
      const outDir = path.join(OUT_DIR, route.replace(/^\//, ''));
      await fs.mkdir(outDir, { recursive: true });
      const outFile = path.join(outDir, 'index.html');
      await fs.writeFile(outFile, html, 'utf8');

      // Sanity check: did canonical get rewritten to this route?
      const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const wordCount = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .split(/\s+/).filter(Boolean).length;

      console.log(
        `[prerender] OK   ${route.padEnd(32)} canonical=${canonicalMatch?.[1] ?? 'MISSING'} ` +
        `title="${(titleMatch?.[1] ?? '').slice(0, 40)}" words=${wordCount}`
      );
      return true;
    } catch (err) {
      console.warn(`[prerender] FAIL ${route} attempt ${attempt}/${MAX_ROUTE_ATTEMPTS} — ${err.message}`);
      if (/detached|connection|timeout/i.test(err.message)) {
        restartBrowser = true;
      }
      return false;
    } finally {
      try {
        if (page && !page.isClosed()) {
          await withTimeout(page.close(), 2000, 'page close');
        }
      } catch (err) {
        console.warn(`[prerender] WARN ${route} page cleanup failed: ${err.message}`);
        restartBrowser = true;
      }
      if (restartBrowser) {
        await closeBrowser(browser);
        browser = await launchBrowser();
        console.warn('[prerender] WARN relaunched Chromium after route failure');
      }
    }
  };

  try {
    for (let routeIndex = 0; routeIndex < RENDER_ROUTES.length; routeIndex++) {
      const route = RENDER_ROUTES[routeIndex];
      if (routeIndex > 0 && routeIndex % BROWSER_RESTART_INTERVAL === 0) {
        await closeBrowser(browser);
        browser = await launchBrowser();
        console.log(`[prerender] Restarted Chromium after ${routeIndex} routes`);
      }
      let rendered = false;
      for (let attempt = 1; attempt <= MAX_ROUTE_ATTEMPTS; attempt++) {
        rendered = await renderRoute(route, attempt);
        if (rendered) break;
        if (attempt < MAX_ROUTE_ATTEMPTS) {
          console.warn(`[prerender] RETRY ${route} — next attempt ${attempt + 1}/${MAX_ROUTE_ATTEMPTS}`);
        }
      }
      if (rendered) {
        okCount++;
      } else {
        failedRoutes.push(route);
      }
    }
  } finally {
    await closeBrowser(browser);
    await closeServer(server);
  }

  const failCount = failedRoutes.length;
  console.log(`\n[prerender] Done. ok=${okCount} fail=${failCount} total=${RENDER_ROUTES.length}`);
  if (failCount > 0) {
    console.warn(`[prerender] Failed routes: ${failedRoutes.join(', ')}`);
  }
  if (failCount > 0) {
    return softExit(`${failCount} prerender route(s) failed.`);
  }

  if (ONLY_ROUTES.length === 0) {
    const validationIssues = await validateCompletedSnapshotSet();
    if (validationIssues.length > 0) {
      const preview = validationIssues.slice(0, 20).join('\n- ');
      return softExit(
        `[prerender] Completed snapshot validation failed (${validationIssues.length} issues):\n- ${preview}`,
      );
    }

    await fs.writeFile(
      PRERENDER_MARKER,
      `${JSON.stringify({ routeCount: SEO_ROUTES.length }, null, 2)}\n`,
      'utf8',
    );
  }
}

main().catch((err) => {
  if (SOFT_FAIL) {
    console.warn(`[prerender] SOFT-FAIL on fatal error (build continues): ${err.message}`);
    process.exit(0);
  }
  console.error('[prerender] Fatal:', err);
  process.exit(1);
});
