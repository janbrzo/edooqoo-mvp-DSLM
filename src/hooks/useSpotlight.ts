/**
 * useSpotlight — Plan v6.9.32
 * Global "draw attention" bus. Components dispatch
 *   window.dispatchEvent(new CustomEvent('app:spotlight', { detail: { id, durationMs? }}))
 * and the <SpotlightOverlay /> renders a radial dim + pulse ring on the
 * element annotated with `data-spotlight="<id>"`.
 */
import { useEffect, useState } from 'react';

export type SpotlightId =
  | 'send-welcome-test'
  | 'learning-roadmap'
  | 'next-lesson-ideas'
  | 'pick-idea'
  | 'add-goal-modal';

export interface SpotlightDetail {
  id: SpotlightId | string;
  /** Auto-clear after N ms (default 8000). Pass 0 to disable. */
  durationMs?: number;
}

export function triggerSpotlight(detail: SpotlightDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app:spotlight', { detail }));
}

export function useSpotlight() {
  const [active, setActive] = useState<SpotlightDetail | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SpotlightDetail>).detail;
      if (!detail?.id) return;
      setActive(detail);
    };
    window.addEventListener('app:spotlight', handler as EventListener);
    return () => window.removeEventListener('app:spotlight', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!active) return;
    const duration = active.durationMs ?? 8000;
    if (duration <= 0) return;
    const t = setTimeout(() => setActive(null), duration);
    return () => clearTimeout(t);
  }, [active]);

  return {
    active,
    clear: () => setActive(null),
  };
}