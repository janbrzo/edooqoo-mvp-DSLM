/**
 * Sprint 2 (S2-E) — SERP snippet limits for programmatic (pSEO) routes.
 *
 * PROBLEM: pSEO templates interpolate variable-length labels, so the same
 * template produced 60-char titles for short topics and 90-char titles for long
 * ones. 124 titles and 215 descriptions shipped truncated in the SERP.
 *
 * RULE: the brand suffix is optional decoration and is dropped first; the rest
 * is cut on a word boundary. Keep these numbers in sync with
 * `scripts/seo/audit-duplicate-meta.mjs`.
 */
export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 155;

const BRAND_SUFFIX_PATTERN = /\s*[|—-]\s*Edooqoo\s*$/;

function trimToWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-—|]+$/, '');
}

/** Keeps " | Edooqoo" only when the full title still fits in 60 characters. */
export function clampSeoTitle(title: string, max = SEO_TITLE_MAX): string {
  const normalized = title.trim().replace(/\s+/g, ' ');
  if (normalized.length <= max) return normalized;
  const bare = normalized.replace(BRAND_SUFFIX_PATTERN, '').trim();
  if (bare.length <= max) return bare;
  return trimToWordBoundary(bare, max);
}

/** Prefers cutting at a sentence boundary so the snippet never ends mid-claim. */
export function clampSeoDescription(description: string, max = SEO_DESCRIPTION_MAX): string {
  const text = description.trim().replace(/\s+/g, ' ');
  if (text.length <= max) return text;
  const window = text.slice(0, max);
  const lastSentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '));
  if (lastSentence > max * 0.55) return window.slice(0, lastSentence + 1).trim();
  return `${trimToWordBoundary(text, max - 1)}.`;
}
