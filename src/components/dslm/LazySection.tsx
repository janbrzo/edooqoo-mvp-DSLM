import React, { useEffect, useRef, useState } from 'react';
import { SectionSkeleton } from './SectionSkeleton';

interface LazySectionProps {
  children: React.ReactNode;
  /** rootMargin for the IntersectionObserver — render content when within this distance from viewport */
  rootMargin?: string;
  /** Force render immediately (e.g. for the first/visible section) */
  eager?: boolean;
}

/**
 * Defers rendering of expensive children (and their data fetching) until
 * the wrapper scrolls near the viewport. Once rendered, stays rendered.
 */
export const LazySection: React.FC<LazySectionProps> = ({
  children,
  rootMargin = '300px',
  eager = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(eager);

  useEffect(() => {
    if (shouldRender) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldRender(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [shouldRender, rootMargin]);

  return <div ref={ref}>{shouldRender ? children : <SectionSkeleton />}</div>;
};
