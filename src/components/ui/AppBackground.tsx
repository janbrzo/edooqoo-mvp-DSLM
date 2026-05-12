import React, { useEffect, useState } from 'react';
import ParticlesBackground from '@/components/landing/ParticlesBackground';

const PATTERN_KEY = 'edooqoo-bg-pattern';
const OPACITY_KEY = 'edooqoo-bg-opacity';
const MIGRATION_KEY = 'edooqoo-bg-pattern-migrated-v1';

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
  // One-time migration to make Particles the default for everyone.
  if (typeof window !== 'undefined' && !localStorage.getItem(MIGRATION_KEY)) {
    localStorage.setItem(PATTERN_KEY, 'particles');
    localStorage.setItem(MIGRATION_KEY, '1');
  }

  const [pattern, setPattern] = useState<string>(() => localStorage.getItem(PATTERN_KEY) || 'particles');
  const [opacity, setOpacity] = useState<number>(() => {
    const v = parseFloat(localStorage.getItem(OPACITY_KEY) || '1');
    return isNaN(v) ? 1 : Math.min(1, Math.max(0, v));
  });

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