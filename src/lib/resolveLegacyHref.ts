// v6.9.22 — Resolver simplified: every legacy .html is now a real static file in public/.
// `comingSoon` is permanently false (Martha quality rule: no stub tiles).
// `isStatic` tells consumers to render <a href> for full-page nav instead of <Link to>.
export type ResolvedHref = { url: string; comingSoon: false; isStatic: boolean };

export function resolveLegacyHref(href: string): ResolvedHref {
  return { url: href, comingSoon: false, isStatic: href.endsWith(".html") };
}