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

export const setCanonicalForPath = (pathname: string) => {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  const href = `${SITE_ORIGIN}${cleanPath === '/' ? '/' : cleanPath}`;
  let link = document.getElementById(CANONICAL_ID) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    link.id = CANONICAL_ID;
    document.head.appendChild(link);
  }
  link.href = href;
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
  }, [pathname]);
};
