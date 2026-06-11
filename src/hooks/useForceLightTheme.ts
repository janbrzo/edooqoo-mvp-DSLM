import { useEffect } from 'react';

/**
 * v6.9.54 — Force-disable dark mode for the lifetime of a page.
 * Used on worksheet/homework/welcome-test/public surfaces where the
 * teacher dark theme tokens would invert the high-contrast white
 * background and destroy readability for anonymous viewers.
 *
 * On unmount, restore dark only if the teacher has it explicitly stored.
 */
export function useForceLightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => {
      try {
        const stored = localStorage.getItem('edooqoo-theme');
        if (stored === 'dark' && hadDark) {
          root.classList.add('dark');
        }
      } catch (_) {
        /* noop */
      }
    };
  }, []);
}