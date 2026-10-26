import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { templatedCloneNoindexSlugs } from '../x1000-editorial-plan.mjs';
import { x1000BlogArticles } from '../x1000-content-plan.mjs';

const BLOG_DIR = path.resolve(__dirname, '../../../public/blog');

describe('templated clone noindex policy', () => {
  it('marks every generated article listed in templatedCloneNoindexSlugs as noindex', () => {
    const leaking = x1000BlogArticles
      .filter((article) => templatedCloneNoindexSlugs.has(article.slug) && !article.noindex)
      .map((article) => article.slug);
    expect(leaking).toEqual([]);
  });

  it('renders noindex,follow in the HTML of every listed slug that exists on disk', () => {
    const missingTag = [...templatedCloneNoindexSlugs].filter((slug) => {
      const file = path.join(BLOG_DIR, slug);
      if (!fs.existsSync(file)) return false;
      return !/<meta name="robots" content="noindex,follow">/.test(fs.readFileSync(file, 'utf8'));
    });
    expect(missingTag).toEqual([]);
  });
});
