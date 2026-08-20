/**
 * Sprint 2 (S2-A) — head metadata deduplication (shared helper).
 *
 * PROBLEM: prerendered SPA snapshots inherit the static <head> from index.html
 * while react-helmet APPENDS its route-specific tags (data-rh="true") instead of
 * replacing them. 131 snapshots therefore shipped two <meta name="description">
 * tags, the first one being the homepage boilerplate — and the first tag is the
 * one search engines read.
 *
 * RULE: when a data-rh variant of a managed tag exists, every non-data-rh
 * variant of that tag is removed (Helmet is the single source of head truth per
 * route). When Helmet did not manage the tag, the static fallback stays.
 *
 * Used by `prerender-spa-routes.mjs` (generation time) and
 * `repair-snapshot-head.mjs` (one-off repair of already committed snapshots).
 */

const DEDUPED_META_TAGS = [
  { attr: 'name', key: 'description' },
  { attr: 'name', key: 'twitter:description' },
  { attr: 'name', key: 'twitter:title' },
  { attr: 'name', key: 'robots' },
  { attr: 'property', key: 'og:description' },
  { attr: 'property', key: 'og:title' },
  { attr: 'property', key: 'og:url' },
];

function metaTagPattern({ attr, key }) {
  return new RegExp(`<meta\\b(?=[^>]*\\b${attr}=["']${key}["'])[^>]*>`, 'gi');
}

export function dedupeHeadMeta(html) {
  let output = html;
  for (const tag of DEDUPED_META_TAGS) {
    const matches = output.match(metaTagPattern(tag)) || [];
    if (matches.length < 2) continue;
    if (!matches.some((match) => /\bdata-rh=["']true["']/i.test(match))) continue;
    output = output.replace(metaTagPattern(tag), (match) =>
      /\bdata-rh=["']true["']/i.test(match) ? match : '',
    );
  }
  return output;
}

export { DEDUPED_META_TAGS };
