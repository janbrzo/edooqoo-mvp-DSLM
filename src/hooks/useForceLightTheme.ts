import { useHardLightSurface } from './useHardLightSurface';

/**
 * v6.9.55 — Now a thin wrapper around `useHardLightSurface` so every
 * existing caller automatically gets the stronger lock (MutationObserver
 * + color-scheme + ref count). Kept under the original name to avoid a
 * sweeping rename across worksheet/homework/welcome-test pages.
 */
export function useForceLightTheme() {
  useHardLightSurface('public-light');
}