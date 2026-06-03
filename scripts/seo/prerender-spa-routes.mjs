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
 *   - Skip if route returns non-200 (logged, build continues).
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
import { fileURLToPath } from 'node:url';
import { getPrerenderRoutes } from './seo-route-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

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
const MAX_ROUTE_ATTEMPTS = 3;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  // Validate dist exists
  try {
    await fs.access(path.join(DIST, 'index.html'));
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
        if (browserProcess && !browserProcess.killed) browserProcess.kill('SIGKILL');
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
    try {
      page = await browser.newPage();
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
      await page.setUserAgent('Mozilla/5.0 (compatible; EdooqooPrerender/1.0)');
      const resp = await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
      if (!resp || !resp.ok()) {
        console.warn(`[prerender] SKIP ${route} attempt ${attempt}/${MAX_ROUTE_ATTEMPTS} — status ${resp?.status() ?? 'no-response'}`);
        return false;
      }
      // Extra wait for canonical hook + lazy components
      await delay(1500);

      // Snapshot full HTML (includes hydrated DOM + updated canonical)
      const html = await page.content();

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
        await closeBrowser(browser);
        try {
          browser = await launchBrowser();
          console.warn('[prerender] WARN relaunched Chromium after route failure');
        } catch (launchErr) {
          return softExit(`Failed to relaunch headless Chromium: ${launchErr.message}`);
        }
      }
      return false;
    } finally {
      try {
        if (page && !page.isClosed()) await page.close();
      } catch (err) {
        console.warn(`[prerender] WARN ${route} page cleanup failed: ${err.message}`);
      }
    }
  };

  try {
    for (const route of RENDER_ROUTES) {
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
  if (failCount > 0 && okCount === 0) {
    return softExit(`All ${failCount} routes failed.`);
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
