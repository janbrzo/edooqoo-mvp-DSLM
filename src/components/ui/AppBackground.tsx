import React, { useEffect, useState } from 'react';
import ParticlesBackground from '@/components/landing/ParticlesBackground';
import { supabase } from '@/integrations/supabase/client';

const PATTERN_KEY = 'edooqoo-bg-pattern';
const OPACITY_KEY = 'edooqoo-bg-opacity';
// v6.9.62 P4 — migration v2: authenticated users default to `waves`, anon
// users keep `particles`. Manual choices saved after v2 are respected.
const MIGRATION_KEY_V1 = 'edooqoo-bg-pattern-migrated-v1';
const MIGRATION_KEY_V2 = 'edooqoo-bg-pattern-migrated-v2';

/**
 * v6.9.10 — Shared animated/patterned background used by both the
 * authenticated teacher shell and the public Student Hub (`/my/...`).
 * Listens to `edooqoo-bg-pattern-changed` and `edooqoo-bg-opacity-changed`
 * dispatched by `BackgroundPatternSwitcher`.
 */
export const AppBackground: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({
  children,
  className = '',
  style,
}) => {
  // Pre-v2 fallback (anon defaults still particles).
  if (typeof window !== 'undefined' && !localStorage.getItem(MIGRATION_KEY_V1)) {
    localStorage.setItem(PATTERN_KEY, 'particles');
    localStorage.setItem(MIGRATION_KEY_V1, '1');
  }

  const [pattern, setPattern] = useState<string>(() => localStorage.getItem(PATTERN_KEY) || 'particles');
  const [opacity, setOpacity] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem(OPACITY_KEY) || '1');
    return isNaN(v) ? 1 : Math.min(1, Math.max(0, v));
  });

  // v6.9.62 P4 — one-time migration to set Waves as default for signed-in
  // teachers. Runs only when MIGRATION_KEY_V2 is missing. Anonymous users
  // keep particles. Manual user selections (after v2 migration) are
  // respected because the migration key short-circuits future runs.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(MIGRATION_KEY_V2)) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const isAuth = !!data?.session?.user;
        const next = isAuth ? 'waves' : 'particles';
        localStorage.setItem(PATTERN_KEY, next);
        localStorage.setItem(MIGRATION_KEY_V2, '1');
        setPattern(next);
        window.dispatchEvent(new CustomEvent('edooqoo-bg-pattern-changed', { detail: next }));
      } catch {
        // best-effort migration; ignore failures
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onPattern = (e: Event) => setPattern((e as CustomEvent).detail);
    const onOpacity = (e: Event) => setOpacity((e as CustomEvent).detail);
    window.addEventListener('edooqoo-bg-pattern-changed', onPattern);
    window.addEventListener('edooqoo-bg-opacity-changed', onOpacity);
    return () => {
      window.removeEventListener('edooqoo-bg-pattern-changed', onPattern);
      window.removeEventListener('edooqoo-bg-opacity-changed', onOpacity);
    };
  }, []);

  return (
    <div
      className={`auth-bg-shell ${className}`}
      data-pattern={pattern}
      style={{ ['--bg-pattern-opacity' as any]: opacity, ...style }}
    >
      {pattern === 'particles' && <ParticlesBackground interactive={false} opacity={opacity} />}
      {children}
    </div>
  );
};

export default AppBackground;