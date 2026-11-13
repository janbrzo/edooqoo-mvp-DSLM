import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: boundary.invoke } } }));
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => store.clear(),
});
import { PENDING_PLACEMENT_CLAIM_KEY, rememberPendingClaim, takePendingClaim, sendPlacementInvite, getPlacementReport, claimPlacementReport, forwardPlacementReport } from '../placementReportApi';

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

describe('placement API boundary', () => {
  beforeEach(() => { vi.clearAllMocks(); boundary.invoke.mockResolvedValue({ data: { success: true }, error: null }); });
  it('sends the teacher name only with invitation creation', async () => {
    const input = { studentName: 'Marta', studentEmail: 'student@example.test', teacherEmail: 'teacher@example.test', teacherName: 'Anna' };
    await sendPlacementInvite(input);
    expect(boundary.invoke).toHaveBeenCalledWith('public-placement-report', { body: { action: 'invite', ...input } });
  });
  it('passes exact tokens without a client-selected audience', async () => {
    await getPlacementReport('student_abcdefghijklmnopqrstuvwx');
    await claimPlacementReport('teacher_abcdefghijklmnopqrstuvwx');
    await forwardPlacementReport('student_abcdefghijklmnopqrstuvwx', 'teacher@example.test');
    expect(boundary.invoke.mock.calls.map(call => call[1].body)).toEqual([
      { action: 'get', token: 'student_abcdefghijklmnopqrstuvwx' },
      { action: 'claim', token: 'teacher_abcdefghijklmnopqrstuvwx' },
      { action: 'forward', token: 'student_abcdefghijklmnopqrstuvwx', teacherEmail: 'teacher@example.test' },
    ]);
  });
  it('propagates failure instead of claiming successful delivery', async () => {
    boundary.invoke.mockResolvedValue({ data: null, error: new Error('Delivery unavailable') });
    await expect(forwardPlacementReport('student_abcdefghijklmnopqrstuvwx', 'teacher@example.test')).rejects.toThrow('Delivery unavailable');
  });
});
