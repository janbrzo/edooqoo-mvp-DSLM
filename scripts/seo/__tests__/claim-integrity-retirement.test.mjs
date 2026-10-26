import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getRoutingDecisions } from '../content-registry.mjs';
import { x1000StaticPages } from '../x1000-content-plan.mjs';
import { REDIRECTS } from '../../../cloudflare/content-routing.generated.mjs';
import { handleRequest } from '../../../cloudflare/worker.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const BASE = 'https://edooqoo.com';
const generator = fs.readFileSync(path.join(ROOT, 'scripts/seo/generate-citable-pages.mjs'), 'utf8');
const start = generator.indexOf('const claimIntegrityPages = [');
const end = generator.indexOf('const proofPage =', start);
if (start < 0 || end < start) throw new Error('Cannot locate claim-integrity page definitions');
// Evaluate only the trusted data literal, without running the generator or writing snapshots.
const claimPages = vm.runInNewContext(`${generator.slice(start, end)}; claimIntegrityPages;`);
const renderedSlugs = new Set([...claimPages, ...x1000StaticPages].map((page) => page.slug));
const decisions = getRoutingDecisions({ root: ROOT });
const retiredRoutes = [
  ['/ai-tools-for-online-esl-teachers.html', '/ai-tools-for-private-english-tutors.html'],
  ['/ai-lesson-prep-tool-vs-chatbot.html', '/chatgpt-alternative-for-english-tutors.html'],
  ['/best-ai-tools-for-private-english-tutors.html', '/ai-tools-for-private-english-tutors.html'],
  ['/worksheet-generator-for-language-schools.html', '/ai-tools-for-private-english-tutors.html'],
];

describe('claim-integrity retirement contract', () => {
  it('retains exactly the two canonical claim-integrity definitions', () => {
    expect(Array.from(claimPages, (page) => page.slug).sort()).toEqual([
      'ai-tools-for-private-english-tutors.html',
      'chatgpt-alternative-for-english-tutors.html',
    ]);
  });

  for (const [route, target] of retiredRoutes) {
    it(`does not render ${route} and preserves its canonical HTTP 301 target`, async () => {
      expect(renderedSlugs.has(route.slice(1))).toBe(false);
      expect(decisions.redirects[route]).toBe(target);
      expect(REDIRECTS[route]).toBe(target);
      const response = await handleRequest(new Request(`${BASE}${route}`), {});
      expect(response.status).toBe(301);
      expect(response.headers.get('location')).toBe(`${BASE}${target}`);
    });
  }

  it('maps AI answer citations to active targets instead of retired routes', () => {
    const answers = fs.readFileSync(path.join(ROOT, 'public/llms-answers.txt'), 'utf8');
    const citedRoutes = [...answers.matchAll(/https:\/\/edooqoo\.com(\/[^\s)]+)/g)]
      .map((match) => match[1]);
    for (const [route] of retiredRoutes) expect(citedRoutes).not.toContain(route);
    expect(citedRoutes).toEqual(expect.arrayContaining([
      '/ai-tools-for-private-english-tutors.html',
      '/chatgpt-alternative-for-english-tutors.html',
      '/edooqoo-vs-chatgpt.html',
    ]));
  });
});