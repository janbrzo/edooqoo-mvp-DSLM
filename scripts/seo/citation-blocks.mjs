/**
 * Sprint 4 (Faza 4) — GEO/AEO citation-block registry.
 *
 * PROBLEM: answer engines (ChatGPT Search, Perplexity, Google AI results, Copilot) need a
 * short, self-contained, extractable paragraph to quote. Only the four cluster hubs had one,
 * so the remaining high-intent pages were paraphrased without attribution or skipped entirely.
 *
 * SOLUTION: a deterministic 40-60 word citation paragraph on every high-intent static page,
 * built brand-first from that page's own <title>/<meta description> plus one verified product
 * fact. No marketing language, no roadmap claims, no invented numbers.
 *
 * Consumers: scripts/seo/inject-citation-blocks.mjs (writes into public/**.html),
 * scripts/seo/audit-structured-data.mjs (coverage guard), src/components/seo/CitationBlock.tsx.
 */

export const CITATION_MARKER = 'data-citation-block';

/**
 * Verified product facts. Every statement here must be PRODUCTION behaviour described in
 * docs/llm-context.md. Rotated deterministically so pages do not share one boilerplate tail.
 */
export const CITATION_FACTS = [
  'Edooqoo is a 1-Minute Prep system for 1:1 English tutors working with adult learners.',
  'Worksheets are generated per student and stay editable before the tutor sends them.',
  'Materials are CEFR-aligned across A1 to C2 and target a single named lesson goal.',
  'The Dynamic Student Learning Model accumulates lesson evidence and suggests the next task.',
  'Generated tasks can be assigned as interactive homework with AI-assisted review.',
  'Vocabulary from a worksheet can become a spaced-repetition flashcard set for the student.',
  'Every AI output is reviewed and edited by the teacher before a student ever sees it.',
];

const BRAND_SUFFIX = / [–—|-] Edooqoo.*$/;

const words = (text) => text.trim().split(/\s+/).filter(Boolean);

const sentence = (text) => {
  const clean = text.replace(BRAND_SUFFIX, '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');
  return clean ? `${clean}.` : '';
};

/** Deterministic index so the same slug always gets the same fact (stable git diffs). */
const hashIndex = (seed, length) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  return hash % length;
};

/**
 * Build a 40-60 word, brand-first citation paragraph.
 * Returns null when the source page has too little factual text to quote.
 */
export function buildCitation({ slug, title, description, url }) {
  const head = sentence(title);
  const body = sentence(description);
  if (!head || !body) return null;

  const parts = [`Edooqoo — ${head}`, body];
  let index = hashIndex(slug, CITATION_FACTS.length);
  let guard = 0;

  const count = () => words(parts.join(' ')).length;

  while (count() < 40 && guard < CITATION_FACTS.length) {
    parts.push(CITATION_FACTS[index]);
    index = (index + 1) % CITATION_FACTS.length;
    guard += 1;
  }

  // Trim from the end at sentence granularity; never cut a sentence in half.
  while (count() > 60 && parts.length > 2) parts.pop();

  if (count() > 60) {
    // Head + body alone are too long: shorten the body to the first clause.
    const shortBody = sentence(body.split(/,|;| — /)[0]);
    parts.splice(1, parts.length - 1, shortBody);
    let i = hashIndex(slug, CITATION_FACTS.length);
    while (count() < 40 && parts.length < 6) {
      parts.push(CITATION_FACTS[i]);
      i = (i + 1) % CITATION_FACTS.length;
    }
  }

  const total = count();
  if (total < 40 || total > 60) return null;

  return { text: parts.join(' '), wordCount: total, url };
}

export const citationHtml = (citation, sourceUrl) =>
  `\n<p ${CITATION_MARKER}="true" data-citation-source="${sourceUrl}">${citation}</p>`;

export const CITATION_BLOCK_REGEX = new RegExp(
  `\\s*<p ${CITATION_MARKER}="true"[^>]*>[\\s\\S]*?<\\/p>`,
  'g',
);
