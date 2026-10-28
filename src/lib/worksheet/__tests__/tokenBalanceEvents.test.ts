import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOKEN_BALANCE_CHANGED_EVENT, notifyTokenBalanceChanged } from '../tokenBalanceEvents';
import { installBrowserStubs } from './browserStubs';

describe('notifyTokenBalanceChanged', () => {
  beforeEach(() => {
    installBrowserStubs();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('dispatches the event balance listeners subscribe to', () => {
    const handler = vi.fn();
    window.addEventListener(TOKEN_BALANCE_CHANGED_EVENT, handler);
    notifyTokenBalanceChanged();
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
