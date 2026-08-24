/**
 * STATUS: NOT ACTIVE ON edooqoo.com (verified 2026-08-24).
 * The apex domain is served by Lovable hosting, so this worker emits no headers in production.
 * Crawl-control signals are delivered in HTML (meta robots, canonical, meta refresh stubs) and in
 * robots.txt. Do not add header-only expectations to audits until DNS is proxied through Cloudflare;
 * once it is, run `npm run seo:verify-live-routing -- --strict-headers`.
 */
import { GONE_ROUTES, NOINDEX_ROUTES, PUBLIC_ROUTES, REDIRECTS } from './content-routing.generated.mjs';

const PRIVATE_PREFIXES = [
  '/admin',
  '/book',
  '/calendar',
  '/dashboard',
  '/flashcards',
  '/forgot-password',
  '/gcal-student-callback',
  '/homework',
  '/login',
  '/my',
  '/my-flashcards',
  '/my-lessons',
  '/payment-success',
  '/profile',
  '/reset-password',
  '/shared',
  '/signup',
  '/student',
  '/success',
  '/test',
  '/welcome-test',
  '/worksheet',
];
const DYNAMIC_PUBLIC_PATTERNS = [
  /^\/english-for\/[^/]+$/,
  /^\/esl-worksheets\/[^/]+\/[^/]+$/,
  /^\/gallery\/[^/]+$/,
  /^\/what-to-teach-next\/[^/]+$/,
  /^\/worksheets\/[^/]+\/[^/]+$/,
];
const DYNAMIC_PRIVATE_PATTERNS = [
  /^\/book\/[^/]+$/,
  /^\/flashcards\/[^/]+$/,
  /^\/homework\/[^/]+(?:\/review)?$/,
  /^\/my\/[^/]+(?:\/(?:flashcards|homework|lessons|profile|settings|worksheets))?$/,
  /^\/my-lessons\/[^/]+$/,
  /^\/shared\/[^/]+$/,
  /^\/student\/[^/]+$/,
  /^\/test\/[^/]+$/,
  /^\/welcome-test\/[^/]+$/,
  /^\/worksheet\/[^/]+$/,
];
const PUBLIC_FILES = new Set([
  '/favicon.ico',
  '/knowledge-graph.json',
  '/llms-answers.txt',
  '/llms-full.txt',
  '/llms.txt',
  '/manifest.webmanifest',
  '/openapi.yaml',
  '/robots.txt',
  '/sitemap.xml',
]);

function isPrivate(pathname) {
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    || DYNAMIC_PRIVATE_PATTERNS.some((pattern) => pattern.test(pathname));
}

function isKnownPublic(pathname) {
  return PUBLIC_ROUTES.has(pathname)
    || PUBLIC_FILES.has(pathname)
    || pathname.startsWith('/assets/')
    || pathname.startsWith('/.well-known/')
    || DYNAMIC_PUBLIC_PATTERNS.some((pattern) => pattern.test(pathname));
}

function notFound() {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>Page not found | Edooqoo</title></head><body><main><h1>Page not found</h1><p>The requested Edooqoo page does not exist.</p><p><a href="/">Go to Edooqoo</a></p></main></body></html>`, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, follow',
      'cache-control': 'public, max-age=60',
    },
  });
}

export async function handleRequest(
  request,
  env,
  routing = { redirects: REDIRECTS, gone: GONE_ROUTES, noindex: NOINDEX_ROUTES, publicRoutes: PUBLIC_ROUTES },
) {
    const incoming = new URL(request.url);

    if (incoming.hostname === 'www.edooqoo.com' || incoming.protocol === 'http:') {
      incoming.hostname = 'edooqoo.com';
      incoming.protocol = 'https:';
      return Response.redirect(incoming.toString(), 301);
    }

    const pathname = incoming.pathname.replace(/\/+$/, '') || '/';

    if (routing.redirects[pathname]) {
      return Response.redirect(new URL(routing.redirects[pathname], incoming.origin), 301);
    }
    if (routing.gone.has(pathname)) {
      return new Response('Gone', {
        status: 410,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, follow' },
      });
    }

    const publicNoindexRoute = routing.noindex.has(pathname);
    const privateRoute = isPrivate(pathname);
    const knownPublic = publicNoindexRoute || routing.publicRoutes.has(pathname) || isKnownPublic(pathname);
    if (!privateRoute && !knownPublic) return notFound();

    if (!env.ASSETS?.fetch) {
      return new Response('Static asset binding is not configured.', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    if (privateRoute) headers.set('x-robots-tag', 'noindex, nofollow');
    else if (publicNoindexRoute) headers.set('x-robots-tag', 'noindex, follow');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
