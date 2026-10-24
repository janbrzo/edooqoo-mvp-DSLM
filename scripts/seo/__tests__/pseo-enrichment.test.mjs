import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PSEO_PACKS, PSEO_PAGE_PACKS } from '../data/pseo-enrichment-data.mjs';
import { ENRICHMENT_END, ENRICHMENT_START, applyEnrichment } from '../enrich-pseo-pages.mjs';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const sitemap = fs.readFileSync(path.join(ROOT, 'public/sitemap.xml'), 'utf8');
const rootPages = [...sitemap.matchAll(/<loc>https:\/\/edooqoo\.com\/([^/<]+\.html)<\/loc>/g)].map((m) => m[1]);
const read = (file) => fs.readFileSync(path.join(ROOT, 'public', file), 'utf8');
const block = (html) => html.slice(html.indexOf(ENRICHMENT_START), html.indexOf(ENRICHMENT_END));

describe('root pSEO enrichment', () => {
  it('covers exactly the 69 indexable root pages', () => {
    expect(rootPages).toHaveLength(69);
    expect(Object.keys(PSEO_PAGE_PACKS).sort()).toEqual([...rootPages].sort());
  });

  it.each(rootPages)('%s has a task, key, errors, tools, decision tool and Gallery link', (file) => {
    const html = read(file);
    const section = block(html);
    expect(section).toContain('Answer key');
    expect(section).toContain('Common Adult Learner Errors');
    expect(section).toContain('href="/tools"');
    expect(section).toMatch(/href="\/tools\/what-should-i-teach-next\?level=(A1|A2|B1|B2|C1|C2)"/);
    expect(section).toContain('href="/gallery"');
    expect(html).toContain(`<link rel="canonical" href="https://edooqoo.com/${file}"`);
    expect(html).not.toMatch(/noindex/i);
  });

  it('packs use adult content without em dashes and with three keyed items', () => {
    for (const pack of Object.values(PSEO_PACKS)) {
      expect(JSON.stringify(pack)).not.toContain('\u2014');
      expect(pack.items).toHaveLength(3);
      expect(pack.items.every(([prompt, answer]) => prompt && answer)).toBe(true);
      expect(pack.mistakes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('is idempotent on committed HTML', () => {
    for (const file of rootPages) {
      const html = read(file);
      expect(applyEnrichment(html, file)).toBe(html);
    }
  });
});
