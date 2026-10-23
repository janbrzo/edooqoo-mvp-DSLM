import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT_OVERRIDES } from '../content-registry.mjs';
import { getRetiredRedirects, rewriteRetiredLinks } from '../rewrite-retired-links.mjs';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const RETIRED = {
  '/blog/managing-large-esl-classes.html': '/blog/teaching-english-one-to-one.html',
  '/blog/pair-work-activities-esl.html': '/blog/how-to-teach-speaking-esl.html',
  '/blog/think-pair-share-esl-variations.html': '/blog/communicative-language-teaching-activities.html',
  '/blog/substitute-teacher-esl-lesson-plans.html': '/blog/one-minute-prep-workflow-for-esl-tutors.html',
  '/blog/peer-editing-workshops-esl.html': '/blog/how-to-teach-writing-esl-students.html',
  '/blog/peer-feedback-activities-english.html': '/blog/error-correction-techniques-esl.html',
  '/blog/holiday-themed-esl-activities.html': '/blog/current-events-esl-lessons.html',
  '/blog/five-minute-filler-activities-esl.html': '/blog/how-long-should-private-english-tutors-spend-on-lesson-prep.html',
  '/blog/warm-up-activities-esl.html': '/blog/how-to-teach-speaking-esl.html',
  '/blog/storytelling-activities-esl.html': '/blog/communicative-language-teaching-activities.html',
  '/blog/trauma-informed-teaching-esl.html': '/blog/teaching-english-one-to-one.html',
  '/blog/tefl-certification-guide.html': '/blog/setting-up-freelance-esl-business.html',
};

const sitemap = fs.readFileSync(path.join(ROOT, 'public/sitemap.xml'), 'utf8');
const sitemapRoutes = [...sitemap.matchAll(/<loc>https:\/\/edooqoo\.com([^<]*)<\/loc>/g)].map((m) => m[1]);

describe('Martha filter: retired school-only articles', () => {
  it.each(Object.entries(RETIRED))('%s merges into %s and leaves the sitemap', (route, target) => {
    expect(CONTENT_OVERRIDES[route]).toMatchObject({ state: 'merge', redirectTo: target });
    expect(sitemapRoutes).not.toContain(route);
    expect(sitemapRoutes).toContain(target);
  });

  it('no sitemap page links to a retired school-only article', () => {
    const offenders = [];
    for (const route of sitemapRoutes.filter((r) => r.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(ROOT, 'public', route), 'utf8');
      for (const retired of Object.keys(RETIRED)) {
        if (html.includes(`href="${retired}"`) || html.includes(`href="https://edooqoo.com${retired}"`)) offenders.push(`${route} -> ${retired}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('rewriteRetiredLinks', () => {
  const redirects = getRetiredRedirects({ '/blog/a.html': { state: 'merge', redirectTo: '/blog/b.html' } });

  it('drops resource-list items for retired routes', () => {
    const html = '<ul>\n  <li><a href="https://edooqoo.com/blog/a.html">A</a> <span class="badge">X</span></li>\n  <li><a href="/blog/c.html">C</a></li>\n</ul>';
    expect(rewriteRetiredLinks(html, redirects)).toBe('<ul>\n  <li><a href="/blog/c.html">C</a></li>\n</ul>');
  });

  it('points inline links at the redirect target', () => {
    expect(rewriteRetiredLinks('<p>See <a href="/blog/a.html">this</a>.</p>', redirects)).toBe('<p>See <a href="/blog/b.html">this</a>.</p>');
  });
});
