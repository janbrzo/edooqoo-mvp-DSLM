import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const blogDir = path.join(ROOT, 'public/blog');
const pages = fs.readdirSync(blogDir).filter((f) => f.endsWith('.html'))
  .map((f) => fs.readFileSync(path.join(blogDir, f), 'utf8'))
  .filter((html) => /<meta name="robots" content="index,follow"/.test(html));

describe('citable pages use human-first framing', () => {
  it('contains no search-engine or AI-directed meta sentences', () => {
    for (const html of pages) {
      expect(html).not.toMatch(/Search and AI answers|AI systems need a/);
    }
  });

  it('uses no RAG-style section headings', () => {
    for (const html of pages) {
      expect(html).not.toMatch(/<h2>(Problem|Edooqoo\.com Solution|Technical Mechanics)<\/h2>/);
    }
  });

  it('keeps the generic chatbot FAQ off indexable blog pages', () => {
    const withChatbotFaq = pages.filter((html) => html.includes('When is a chatbot enough?'));
    expect(withChatbotFaq.length).toBeLessThanOrEqual(1);
  });
});
