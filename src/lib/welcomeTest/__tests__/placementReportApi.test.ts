import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
});
import { PENDING_PLACEMENT_CLAIM_KEY, rememberPendingClaim, takePendingClaim } from '../placementReportApi';

describe('pending placement claim', () => {
  beforeEach(() => localStorage.clear());
  it('returns a remembered report token once', () => {
    rememberPendingClaim('abcdefghijklmnopqrstuvwx');
    expect(takePendingClaim()).toBe('abcdefghijklmnopqrstuvwx');
    expect(takePendingClaim()).toBeNull();
  });
  it('ignores a malformed stored token', () => {
    localStorage.setItem(PENDING_PLACEMENT_CLAIM_KEY, '../../evil');
    expect(takePendingClaim()).toBeNull();
  });
});
