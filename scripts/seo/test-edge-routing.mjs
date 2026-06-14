#!/usr/bin/env node
import assert from 'node:assert/strict';
import { handleRequest } from '../../cloudflare/worker.mjs';

const routing = {
  redirects: { '/old-article': '/blog' },
  gone: new Set(['/retired-article']),
  noindex: new Set(['/private-preview']),
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

const gone = await handleRequest(new Request('https://edooqoo.com/retired-article'), env, routing);
assert.equal(gone.status, 410);
assert.match(gone.headers.get('x-robots-tag') || '', /noindex/);

const privatePage = await handleRequest(new Request('https://edooqoo.com/private-preview'), env, routing);
assert.equal(privatePage.status, 200);
assert.equal(privatePage.headers.get('x-robots-tag'), 'noindex, nofollow');

const publicProgrammatic = await handleRequest(
  new Request('https://edooqoo.com/worksheets/fill-in-the-blanks/present-perfect'),
  env,
  routing,
);
assert.equal(publicProgrammatic.status, 200);
assert.equal(publicProgrammatic.headers.get('x-robots-tag'), null);

console.log('[edge-routing-test] PASS 404, 301, 410, private noindex, public programmatic route');
