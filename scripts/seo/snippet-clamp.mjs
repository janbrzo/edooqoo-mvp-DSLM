/**
 * SERP snippet clamping shared by the HTML generators and the snapshot repair
 * script. Mirrors `src/utils/seoSnippet.ts`; keep the numbers in sync with it
 * and with `scripts/seo/audit-duplicate-meta.mjs`.
 *
 * Generators must clamp at render time: the committed `public/` snapshots are
 * clamped, so an unclamped generator makes every regeneration reintroduce
 * over-long titles/descriptions and fail the "generated files are committed"
 * CI step.
 */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

const BRAND_SUFFIX_PATTERN = /\s*[|—-]\s*Edooqoo\s*$/;

export function trimToWordBoundary(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.\-—|]+$/, '');
}

export function clampTitle(title) {
  const normalized = title.trim().replace(/\s+/g, ' ');
  if (normalized.length <= TITLE_MAX) return normalized;
  const bare = normalized.replace(BRAND_SUFFIX_PATTERN, '').trim();
  if (bare.length <= TITLE_MAX) return bare;
  return trimToWordBoundary(bare, TITLE_MAX);
}

export function clampDescription(description) {
  const text = description.trim().replace(/\s+/g, ' ');
  if (text.length <= DESCRIPTION_MAX) return text;
  const window = text.slice(0, DESCRIPTION_MAX);
  const lastSentence = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '));
  if (lastSentence > DESCRIPTION_MAX * 0.55) return window.slice(0, lastSentence + 1).trim();
  return `${trimToWordBoundary(text, DESCRIPTION_MAX - 1)}.`;
}
