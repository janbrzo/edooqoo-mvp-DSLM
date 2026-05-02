/**
 * Development-only logging utility.
 * In production builds, these functions are no-ops to prevent
 * leaking internal data (user IDs, tokens, emails) to the browser console.
 *
 * console.error and console.warn are intentionally NOT wrapped —
 * they remain active in production for critical debugging.
 */

export const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
};

export const devWarn = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};
