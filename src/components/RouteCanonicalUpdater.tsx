/**
 * RouteCanonicalUpdater — invisible component mounted once inside <BrowserRouter>.
 * Updates <link rel="canonical"> on every route change so each SPA URL points to itself.
 */
import { useCanonicalSync } from '@/hooks/useCanonical';

export const RouteCanonicalUpdater = () => {
  useCanonicalSync();
  return null;
};

export default RouteCanonicalUpdater;
