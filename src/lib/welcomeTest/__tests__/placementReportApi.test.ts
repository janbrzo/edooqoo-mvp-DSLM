import { beforeEach, describe, expect, it } from 'vitest';
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
