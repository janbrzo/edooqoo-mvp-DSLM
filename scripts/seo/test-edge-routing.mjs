#!/usr/bin/env node
import assert from 'node:assert/strict';
import { handleRequest } from '../../cloudflare/worker.mjs';

const routing = {
  redirects: { '/old-article': '/blog' },
  gone: new Set(['/retired-article']),
  noindex: new Set([
    '/newsletter/confirmed',
    '/newsletter/unsubscribed',
    '/worksheets/matching/reported-speech',
  ]),
  publicRoutes: new Set(['/', '/blog', '/worksheets/fill-in-the-blanks/present-perfect']),
};
const env = {
  ASSETS: {
    fetch: async (request) => new Response(`asset:${new URL(request.url).pathname}`, {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    }),
  },
};

const unknown = await handleRequest(new Request('https://edooqoo.com/not-a-real-page'), env, routing);
assert.equal(unknown.status, 404);
assert.match(unknown.headers.get('x-robots-tag') || '', /noindex/);

const redirect = await handleRequest(new Request('https://edooqoo.com/old-article'), env, routing);
assert.equal(redirect.status, 301);
assert.equal(redirect.headers.get('location'), 'https://edooqoo.com/blog');

const wwwRedirect = await handleRequest(new Request('https://www.edooqoo.com/blog'), env, routing);
assert.equal(wwwRedirect.status, 301);
assert.equal(wwwRedirect.headers.get('location'), 'https://edooqoo.com/blog');

const httpRedirect = await handleRequest(new Request('http://edooqoo.com/blog'), env, routing);
assert.equal(httpRedirect.status, 301);
assert.equal(httpRedirect.headers.get('location'), 'https://edooqoo.com/blog');

const gone = await handleRequest(new Request('https://edooqoo.com/retired-article'), env, routing);
assert.equal(gone.status, 410);
assert.match(gone.headers.get('x-robots-tag') || '', /noindex/);

const privatePage = await handleRequest(new Request('https://edooqoo.com/dashboard'), env, routing);
assert.equal(privatePage.status, 200);
assert.equal(privatePage.headers.get('x-robots-tag'), 'noindex, nofollow');

const publicNoindex = await handleRequest(
  new Request('https://edooqoo.com/worksheets/matching/reported-speech'),
  env,
  routing,
);
assert.equal(publicNoindex.status, 200);
assert.equal(publicNoindex.headers.get('x-robots-tag'), 'noindex, follow');

for (const path of ['/newsletter/confirmed', '/newsletter/unsubscribed']) {
  const lifecyclePage = await handleRequest(new Request(`https://edooqoo.com${path}`), env, routing);
  assert.equal(lifecyclePage.status, 200);
  assert.equal(lifecyclePage.headers.get('x-robots-tag'), 'noindex, follow');
}

const publicProgrammatic = await handleRequest(
  new Request('https://edooqoo.com/worksheets/fill-in-the-blanks/present-perfect'),
  env,
  routing,
);
assert.equal(publicProgrammatic.status, 200);
assert.equal(publicProgrammatic.headers.get('x-robots-tag'), null);

console.log('[edge-routing-test] PASS 404, 301, host canonical, 410, private noindex, newsletter noindex, public noindex, public programmatic route');
