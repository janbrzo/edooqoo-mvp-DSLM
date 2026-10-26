import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DECISION_PAYLOAD_MAX_CHARS,
  __resetDecisionLogForTests,
  capDecisionPayload,
  logDslmDecision,
  logDslmDecisionOnce,
} from '../decisionLog';

const STUDENT = '11111111-1111-4111-8111-111111111111';
const ok = () => vi.fn().mockResolvedValue({ data: 'id', error: null });

const store = new Map<string, string>();
const localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  clear: () => store.clear(),
};

beforeEach(() => {
  __resetDecisionLogForTests();
  vi.stubGlobal('localStorage', localStorage);
  store.clear();
});

describe('logDslmDecision', () => {
  it('sends the RPC with the agreed argument names', async () => {
    const rpc = ok();
    expect(await logDslmDecision({ studentId: STUDENT, type: 'pacing_proposal_seen', sourceId: 'p1', payload: { a: 1 } }, rpc)).toBe(true);
    expect(rpc).toHaveBeenCalledWith('log_dslm_decision', {
      p_student_id: STUDENT, p_decision_type: 'pacing_proposal_seen', p_source_id: 'p1', p_payload: { a: 1 },
    });
  });

  it('ignores a missing function and stops calling for the session', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.log_dslm_decision' } });
    expect(await logDslmDecision({ studentId: STUDENT, type: 'level_suggestion_accepted' }, rpc)).toBe(false);
    expect(await logDslmDecision({ studentId: STUDENT, type: 'level_suggestion_accepted' }, rpc)).toBe(false);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('never throws on an RPC error or a thrown error', async () => {
    const failing = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
    await expect(logDslmDecision({ studentId: STUDENT, type: 'pacing_proposal_dismissed' }, failing)).resolves.toBe(false);
    const throwing = vi.fn().mockRejectedValue(new Error('network'));
    await expect(logDslmDecision({ studentId: STUDENT, type: 'pacing_proposal_dismissed' }, throwing)).resolves.toBe(false);
  });

  it('is skipped in demo mode and for demo or missing students', async () => {
    const rpc = ok();
    localStorage.setItem('edooqoo_demo_mode', 'true');
    expect(await logDslmDecision({ studentId: STUDENT, type: 'pacing_proposal_seen' }, rpc)).toBe(false);
    localStorage.clear();
    expect(await logDslmDecision({ studentId: 'demo-1', type: 'pacing_proposal_seen' }, rpc)).toBe(false);
    expect(await logDslmDecision({ studentId: null, type: 'pacing_proposal_seen' }, rpc)).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('logOnce sends once per key', async () => {
    const rpc = ok();
    logDslmDecisionOnce('k', { studentId: STUDENT, type: 'pacing_proposal_seen' }, rpc);
    logDslmDecisionOnce('k', { studentId: STUDENT, type: 'pacing_proposal_seen' }, rpc);
    await Promise.resolve();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});

describe('capDecisionPayload', () => {
  it('cuts long strings and drops undefined', () => {
    const out = capDecisionPayload({ s: 'x'.repeat(2000), u: undefined, n: 1 });
    expect((out.s as string).length).toBe(500);
    expect('u' in out).toBe(false);
  });
  it('replaces an oversized payload by a marker', () => {
    const big = { items: Array.from({ length: 100 }, () => ({ t: 'y'.repeat(400) })) };
    const out = capDecisionPayload(big);
    expect(out.truncated).toBe(true);
    expect(JSON.stringify(out).length).toBeLessThan(DECISION_PAYLOAD_MAX_CHARS);
  });
  it('null gives an empty object', () => expect(capDecisionPayload(null)).toEqual({}));
});
