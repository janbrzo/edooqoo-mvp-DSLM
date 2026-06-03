/**
 * SpotlightOverlay — Plan v6.9.32
 * Renders a fixed full-viewport dim with a transparent "hole" around the
 * element annotated `data-spotlight="<id>"`. Listens for app:spotlight
 * events (see useSpotlight) and also auto-fires for ?focus=<id> URL param.
 *
 * Designed to be mounted ONCE near the app root.
 */
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useSpotlight, triggerSpotlight } from '@/hooks/useSpotlight';

const PAD = 12; // px of breathing room around the highlighted element

interface Rect { top: number; left: number; width: number; height: number; }

function getRect(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: Math.max(0, r.top - PAD),
    left: Math.max(0, r.left - PAD),
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

export const SpotlightOverlay: React.FC = () => {
  const { active, clear } = useSpotlight();
  const [rect, setRect] = useState<Rect | null>(null);
  const rafRef = useRef<number | null>(null);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL ?focus=<id> → fire spotlight, then clean the URL param.
  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus) return;
    const t = setTimeout(() => {
      triggerSpotlight({ id: focus });
      // Strip focus from URL so navigating back/forward doesn't re-trigger.
      const next = new URLSearchParams(searchParams);
      next.delete('focus');
      next.delete('_');
      setSearchParams(next, { replace: true });
    }, 600); // allow DOM render & scroll
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, searchParams.get('focus'), searchParams.get('_')]);

  useEffect(() => {
    if (!active) { setRect(null); return; }
    let cancelled = false;

    const find = () => {
      const el = document.querySelector(`[data-spotlight="${CSS.escape(String(active.id))}"]`);
      if (!el) {
        // Retry until DOM is ready (up to ~3s)
        return null;
      }
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
      return el;
    };

    const tick = () => {
      if (cancelled) return;
      const el = find();
      if (el) setRect(getRect(el));
      rafRef.current = requestAnimationFrame(tick);
    };

    // Initial polling for element to appear
    let attempts = 0;
    const poll = setInterval(() => {
      const el = find();
      if (el || attempts++ > 30) {
        clearInterval(poll);
        if (el) {
          setRect(getRect(el));
          rafRef.current = requestAnimationFrame(tick);
        } else {
          // Element never appeared → bail silently
          clear();
        }
      }
    }, 100);

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') clear(); };
    window.addEventListener('keydown', onKey);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKey);
    };
  }, [active, clear]);

  if (!active || !rect) return null;

  // 4 dim panels around the hole — no SVG mask hassle, fully clickable hole.
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // v6.9.34 — dim panels are NON-interactive. They MUST NOT swallow clicks,
  // otherwise users can't interact with elements visually outside the dim
  // (which appears to be the case for buttons rendered above the fold).
  // The user closes spotlight via ESC, the explicit × button, or by clicking
  // the highlighted element itself (handled below).
  const dim = 'fixed bg-black/60 pointer-events-none transition-opacity duration-200';

  return createPortal(
    <div className="fixed inset-0 z-[100]" aria-live="polite">
      {/* top */}
      <div className={dim} style={{ top: 0, left: 0, width: vw, height: rect.top }} />
      {/* bottom */}
      <div className={dim} style={{ top: rect.top + rect.height, left: 0, width: vw, height: Math.max(0, vh - (rect.top + rect.height)) }} />
      {/* left */}
      <div className={dim} style={{ top: rect.top, left: 0, width: rect.left, height: rect.height }} />
      {/* right */}
      <div className={dim} style={{ top: rect.top, left: rect.left + rect.width, width: Math.max(0, vw - (rect.left + rect.width)), height: rect.height }} />

      {/* Pulse ring around the hole */}
      <div
        className="fixed rounded-xl ring-4 ring-primary animate-pulse pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0)]"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />

      {/* Hint tooltip with explicit close button (pointer-events-auto). */}
      <div
        className="fixed flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium shadow-lg pointer-events-auto"
        style={{
          top: Math.min(vh - 36, rect.top + rect.height + 8),
          left: Math.min(vw - 220, Math.max(8, rect.left)),
        }}
      >
        <span>👉 Click the highlighted element · ESC to dismiss</span>
        <button
          type="button"
          aria-label="Dismiss spotlight"
          onClick={clear}
          className="ml-1 rounded hover:bg-white/20 px-1.5 leading-none text-base"
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default SpotlightOverlay;