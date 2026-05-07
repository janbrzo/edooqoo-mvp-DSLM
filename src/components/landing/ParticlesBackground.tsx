import { useEffect, useState, useMemo } from 'react';
import Particles, { initParticlesEngine } from '@tsparticles/react';
import { loadSlim } from '@tsparticles/slim';

/**
 * v6.9.8 — Animated particle background for the public landing page only.
 * Config converted from particles.js JSON (vincentgarreau.com) to tsparticles v3.
 * Renders fixed full-viewport, behind all content (z-index: -10).
 */
interface ParticlesBackgroundProps {
  /** When false, hover/click interactions are disabled (used in authenticated shell). */
  interactive?: boolean;
}

export default function ParticlesBackground({ interactive = true }: ParticlesBackgroundProps = {}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setReady(true));
  }, []);

  const options = useMemo(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    return {
      fullScreen: { enable: false },
      background: { color: { value: 'transparent' } },
      detectRetina: true,
      fpsLimit: 60,
      particles: {
        number: {
          value: isMobile ? 80 : 250,
          density: { enable: true, area: 790 },
        },
        color: { value: '#643cdd' },
        shape: { type: 'circle' },
        opacity: { value: 0.5 },
        size: { value: { min: 0.5, max: 2 } },
        links: {
          enable: true,
          distance: 150,
          color: '#9d8af5',
          opacity: interactive ? 0.4 : 1,
          width: 1,
        },
        move: {
          enable: true,
          speed: 0.3,
          direction: 'top' as const,
          random: true,
          straight: false,
          outModes: { default: 'out' as const },
        },
      },
      interactivity: {
        detectsOn: 'window' as const,
        events: {
          onHover: { enable: interactive, mode: 'grab' },
          onClick: { enable: interactive, mode: 'push' },
          resize: { enable: true },
        },
        modes: {
          grab: { distance: 225, links: { opacity: 1 } },
          push: { quantity: 4 },
        },
      },
    };
  }, [interactive]);

  if (!ready) return null;

  return (
    <Particles
      id="bg-particles"
      options={options as any}
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  );
}
