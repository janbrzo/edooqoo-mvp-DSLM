/**
 * Fired after a token charge happened outside the page that shows the balance
 * (the background job poller consumes the token after a reload or navigation).
 * `useTokenSystem` listens and refetches, so the header counter never lags.
 */
export const TOKEN_BALANCE_CHANGED_EVENT = 'edooqoo:tokenBalanceChanged';

export function notifyTokenBalanceChanged(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(TOKEN_BALANCE_CHANGED_EVENT));
  } catch {
    /* ignore */
  }
}
