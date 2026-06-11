import { useEffect } from 'react';

/**
 * v6.9.55 — Hard light-mode lock for worksheet / homework / welcome-test
 * surfaces. Stronger than `useForceLightTheme`:
 *   - removes the `.dark` class on mount,
 *   - forces `color-scheme: light` so the browser cannot auto-darken,
 *   - installs a MutationObserver that immediately strips `.dark` if any
 *     later code path (teacher theme hook, storage sync, etc.) tries to
 *     re-enable dark mode while the surface is mounted.
 *
 * Reference counted: multiple worksheet/homework surfaces can stack the lock
 * without fighting each other. The teacher's stored `edooqoo-theme=dark`
 * preference is restored on the last unmount only.
 */

interface LockState {
  count: number;
  observer: MutationObserver | null;
  prevColorScheme: string | null;
  prevDark: boolean;
}

const w: any = typeof window !== 'undefined' ? window : null;
const KEY = '__edooqooLightLock';

function getState(): LockState {
  if (!w) return { count: 0, observer: null, prevColorScheme: null, prevDark: false };
  if (!w[KEY]) {
    w[KEY] = {
      count: 0,
      observer: null,
      prevColorScheme: null,
      prevDark: false,
    } as LockState;
  }
  return w[KEY] as LockState;
}

function engageLock(surfaceName: string) {
  if (typeof document === 'undefined') return;
  const state = getState();
  const root = document.documentElement;
  if (state.count === 0) {
    state.prevDark = root.classList.contains('dark');
    state.prevColorScheme = root.style.colorScheme || null;
    root.classList.remove('dark');
    try { root.style.colorScheme = 'light'; } catch { /* ignore */ }
    try { root.dataset.edooqooForcedLight = surfaceName; } catch { /* ignore */ }
    const observer = new MutationObserver(() => {
      if (root.classList.contains('dark')) {
        root.classList.remove('dark');
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    state.observer = observer;
  }
  state.count += 1;
}

function releaseLock() {
  if (typeof document === 'undefined') return;
  const state = getState();
  if (state.count <= 0) return;
  state.count -= 1;
  if (state.count > 0) return;

  if (state.observer) {
    try { state.observer.disconnect(); } catch { /* ignore */ }
    state.observer = null;
  }
  const root = document.documentElement;
  try {
    if (state.prevColorScheme === null) {
      root.style.removeProperty('color-scheme');
    } else {
      root.style.colorScheme = state.prevColorScheme;
    }
    delete (root.dataset as any).edooqooForcedLight;
  } catch { /* ignore */ }

  // Restore dark mode ONLY if the teacher has it explicitly stored.
  // This guarantees worksheet/homework never flicker into dark on exit
  // unless the user actually chose dark in settings.
  try {
    const stored = window.localStorage.getItem('edooqoo-theme');
    if (stored === 'dark') {
      root.classList.add('dark');
    }
  } catch { /* ignore */ }

  state.prevColorScheme = null;
  state.prevDark = false;
}

export function useHardLightSurface(surfaceName = 'edooqoo-light-surface') {
  useEffect(() => {
    engageLock(surfaceName);
    return () => {
      releaseLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}