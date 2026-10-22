import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  STRATEGIC_BOILERPLATE_REWRITES,
  STRATEGIC_BOILERPLATE_REWRITE_SLUGS,
} from '../strategic-boilerplate-rewrites.mjs';
import { templatedCloneNoindexSlugs, x1000EditorialBlogArticles } from '../x1000-editorial-plan.mjs';

const BLOG_DIR = path.resolve(__dirname, '../../../public/blog');
const BOILERPLATE = [
  'Private adult English tutors need lesson decisions grounded in one learner',
  'Frame the page around one adult learner, one observable performance need',
  'Public pages describe workflow mechanics only; authenticated app surfaces handle',
  'When is a chatbot enough?',
];

describe('Step 1 strategic boilerplate rewrites', () => {
  it('covers exactly the 17 measured strategic clones', () => {
    expect(STRATEGIC_BOILERPLATE_REWRITE_SLUGS).toHaveLength(17);
  });

  it('gives every entry its own complete editorial fields and five FAQs', () => {
    for (const [slug, entry] of Object.entries(STRATEGIC_BOILERPLATE_REWRITES)) {
      for (const field of ['h1', 'directAnswer', 'problem', 'solution', 'mechanics', 'works', 'notEnough', 'tutorDecision', 'example']) {
        expect(entry[field], `${slug}.${field}`).toBeTruthy();
      }
      expect(entry.example.startsWith('Constructed example.'), slug).toBe(true);
      expect(entry.faqs.length, slug).toBeGreaterThanOrEqual(5);
    }
  });

  it('renders as bespoke, indexable articles', () => {
    for (const slug of STRATEGIC_BOILERPLATE_REWRITE_SLUGS) {
      const spec = x1000EditorialBlogArticles.find((article) => article.slug === slug);
      expect(spec?.bespoke, slug).toBe(true);
      expect(spec?.noindex, slug).toBe(false);
      expect(templatedCloneNoindexSlugs.has(slug), slug).toBe(false);
    }
  });

  it('generated HTML keeps index, self canonical, one H1 and no shared boilerplate', () => {
    for (const slug of STRATEGIC_BOILERPLATE_REWRITE_SLUGS) {
      const html = fs.readFileSync(path.join(BLOG_DIR, slug), 'utf8');
      expect(html, slug).not.toMatch(/name="robots" content="noindex/);
      expect(html, slug).toContain(`<link rel="canonical" href="https://edooqoo.com/blog/${slug}">`);
      expect(html.match(/<h1[\s>]/g)?.length, slug).toBe(1);
      expect(html, slug).not.toContain('<p>undefined</p>');
      expect(html, slug).not.toContain('\u2014');
      for (const phrase of BOILERPLATE) expect(html, `${slug}: ${phrase}`).not.toContain(phrase);
    }
  });
});
