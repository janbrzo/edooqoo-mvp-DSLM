/**
 * useCanonical — keeps <link rel="canonical" id="dynamic-canonical"> in sync with the
 * current SPA route. Mounted once via <RouteCanonicalUpdater />. Also exposes setNoindex
 * helpers used by NotFound / Login.
 *
 * Why: index.html is served as the SPA fallback for every client-side route. A static
 * canonical pointing to "/" makes Google treat every SPA route as a duplicate of home
 * (Google Search Console "Alternate page with proper canonical tag"). We rewrite the
 * canonical per route so each SPA URL self-canonicalizes.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_ORIGIN = 'https://edooqoo.com';
const CANONICAL_ID = 'dynamic-canonical';

const isHelmetManaged = (el: Element) => el.hasAttribute('data-rh');

/**
 * Root-only head tags (homepage canonical, BreadcrumbList / WebPage / FAQPage JSON-LD)
 * live in index.html, which is also the SPA fallback shell for every client route.
 * On any non-root route we drop them so subpages never report the homepage canonical
 * or homepage structured data.
 */
const pruneRootOnlyTags = (isRoot: boolean) => {
  if (isRoot) return;
  document.querySelectorAll('[data-root-only]').forEach((el) => el.remove());
};

/** Guarantees exactly one <link rel="canonical"> in the document head. */
const dedupeCanonicals = () => {
  const links = Array.from(
    document.querySelectorAll('link[rel="canonical"]'),
  ) as HTMLLinkElement[];
  if (links.length < 2) return;
  const keep = links.find(isHelmetManaged) ?? links[0];
  links.forEach((link) => {
    if (link !== keep) link.remove();
  });
};

export const setCanonicalForPath = (pathname: string) => {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const isRoot = cleanPath === '/';
  const href = `${SITE_ORIGIN}${isRoot ? '/' : cleanPath}`;

  pruneRootOnlyTags(isRoot);

  const existing = Array.from(
    document.querySelectorAll('link[rel="canonical"]'),
  ) as HTMLLinkElement[];

  // A route rendering <PageSeo> owns its canonical through react-helmet-async.
  const helmetCanonical = existing.find(isHelmetManaged);
  if (helmetCanonical) {
    document.getElementById(CANONICAL_ID)?.remove();
    dedupeCanonicals();
    return;
  }

  let link = (document.getElementById(CANONICAL_ID) as HTMLLinkElement | null)
    ?? existing[0]
    ?? null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.id = CANONICAL_ID;
  link.removeAttribute('data-root-only');
  link.href = href;
  dedupeCanonicals();
};

export const removeCanonical = () => {
  document.getElementById(CANONICAL_ID)?.remove();
};

export const setRobotsMeta = (content: string) => {
  let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'robots';
    document.head.appendChild(meta);
  }
  meta.content = content;
  return () => {
    meta?.remove();
  };
};

export const useCanonicalSync = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    setCanonicalForPath(pathname);
    // Helmet commits its own tags after this effect; re-run so the winner is
    // the route-owned canonical and never a leftover duplicate.
    const t1 = window.setTimeout(() => setCanonicalForPath(pathname), 0);
    const t2 = window.setTimeout(() => setCanonicalForPath(pathname), 400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);
};
