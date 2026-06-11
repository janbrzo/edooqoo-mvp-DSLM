import { useState, useEffect } from 'react';

type Theme = 'system' | 'light' | 'dark';
const STORAGE_KEY = 'edooqoo-theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system';
  });

  // v6.9.54 — Dark mode is teacher-only and must be an explicit opt-in.
  // 'system' resolves to light so anonymous worksheet/homework surfaces
  // never inherit the OS dark preference and invert their tokens.
  const applyTheme = (t: Theme) => {
    const isDark = t === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    applyTheme(t);
  };

  return { theme, setTheme };
}
