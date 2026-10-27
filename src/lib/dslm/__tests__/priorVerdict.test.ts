import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateInitialMasteryForItem, storedItemSourceByQuestion } from '@/utils/masteryCalculator';
import { describePrefillItem, finalizePriorVerdict } from '../priorVerdict';
import { __resetMarkDoneSaveForTests, saveMarkDoneEvaluationRpc } from '../markDoneSave';

const base = { name: 'g.x', itemIndex: 0, fromSavedRatings: false };

describe('describePrefillItem', () => {
  it('live AI wins over stored and key', () => {
    const r = describePrefillItem({ ...base, mastery: 70, hasValue: true, aiEvaluations: { 0: 70 }, storedEvaluations: { 0: 40 }, keyMastery: 0 });
    expect(r).toMatchObject({ prefill_source: 'ai_live', prefill_mastery: 70, ai_score: 70, stored_mastery: 40, key_mastery: 0 });
  });
  it('stored ai_alternative is told from a plain stored value', () => {
    const alt = describePrefillItem({ ...base, mastery: 90, hasValue: true, storedEvaluations: { 0: 90 }, storedSources: { 0: 'ai_alternative' }, keyMastery: 0 });
    expect(alt).toMatchObject({ prefill_source: 'stored_ai_alternative', stored_source: 'ai_alternative' });
    expect(describePrefillItem({ ...base, mastery: 60, hasValue: true, storedEvaluations: { 0: 60 } }).prefill_source).toBe('stored');
  });
  it('key, none and saved teacher', () => {
    expect(describePrefillItem({ ...base, mastery: 100, hasValue: true, keyMastery: 100 }).prefill_source).toBe('key');
    const none = describePrefillItem({ ...base, mastery: null, hasValue: false });
    expect(none).toMatchObject({ prefill_source: 'none', prefill_mastery: null });
    expect(describePrefillItem({ ...base, mastery: 55, hasValue: true, fromSavedRatings: true }).prefill_source).toBe('saved_teacher');
  });
  it('agrees with calculateInitialMasteryForItem on the value for real inputs', () => {
    const ex = { type: 'fill-in-blanks', questions: [{ answer: 'goes' }] };
    const init = calculateInitialMasteryForItem(0, { 0: 'goes' }, ex, { 0: 80 }, { 0: 10 });
    expect(describePrefillItem({ ...base, ...init, aiEvaluations: { 0: 80 }, storedEvaluations: { 0: 10 } }).prefill_mastery).toBe(init.mastery);
  });
});

describe('finalizePriorVerdict', () => {
  const prefill = [
    describePrefillItem({ ...base, name: 'a', itemIndex: 0, mastery: 70, hasValue: true, aiEvaluations: { 0: 70 } }),
    describePrefillItem({ ...base, name: 'b', itemIndex: 1, mastery: null, hasValue: false }),
    describePrefillItem({ ...base, name: 'c', itemIndex: 2, mastery: 100, hasValue: true, keyMastery: 100 }),
  ];
  it('keeps only saved rows, with final value and changed flag', () => {
    const out = finalizePriorVerdict(prefill, [
      { mastery: 70, hasValue: true }, { mastery: null, hasValue: false }, { mastery: 40, hasValue: true },
    ]);
    expect(out?.version).toBe(1);
    expect(out?.items.map((i) => [i.name, i.final_mastery, i.changed])).toEqual([['a', 70, false], ['c', 40, true]]);
  });
  it('stays under the size the RPC accepts', () => {
    const many = Array.from({ length: 80 }, (_, i) => describePrefillItem({ ...base, name: `skill.${i}.` + 'n'.repeat(60), itemIndex: i, mastery: 50, hasValue: true, aiEvaluations: { [i]: 50 } }));
    const out = finalizePriorVerdict(many, many.map(() => ({ mastery: 60, hasValue: true })));
    expect(JSON.stringify(out).length).toBeLessThanOrEqual(6500);
    expect(out!.items.length).toBeGreaterThan(0);
  });
  it('returns null when nothing is saved or lengths differ', () => {
    expect(finalizePriorVerdict(prefill, [{ mastery: null, hasValue: false }, { mastery: null, hasValue: false }, { mastery: null, hasValue: false }])).toBeNull();
    expect(finalizePriorVerdict(prefill, [{ mastery: 1, hasValue: true }])).toBeNull();
    expect(finalizePriorVerdict(null, [])).toBeNull();
  });
});

describe('storedItemSourceByQuestion', () => {
  it('reads the source of the first scored rating per question', () => {
    expect(storedItemSourceByQuestion([
      { question_index: 0, mastery: 90, source: 'ai_alternative' },
      { question_index: 0, mastery: 10, source: 'other' },
      { question_index: 1, mastery: -1, source: 'x' },
      { question_index: 2, mastery: 50 },
    ])).toEqual({ 0: 'ai_alternative' });
  });
});

describe('saveMarkDoneEvaluationRpc', () => {
  beforeEach(() => __resetMarkDoneSaveForTests());
  const prior = { version: 1 as const, items: [] };
  const miss = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };

  it('passes p_prior_verdict when the server has it', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    await saveMarkDoneEvaluationRpc({ p_student_id: 's' }, prior, rpc);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1]).toEqual({ p_student_id: 's', p_prior_verdict: prior });
  });
  it('retries with the old signature once and remembers it', async () => {
    const rpc = vi.fn().mockResolvedValueOnce(miss).mockResolvedValue({ data: 1, error: null });
    const res = await saveMarkDoneEvaluationRpc({ p_student_id: 's' }, prior, rpc);
    expect(res.error).toBeNull();
    expect(rpc.mock.calls[1][1]).toEqual({ p_student_id: 's' });
    await saveMarkDoneEvaluationRpc({ p_student_id: 's' }, prior, rpc);
    expect(rpc).toHaveBeenCalledTimes(3);
    expect(rpc.mock.calls[2][1]).toEqual({ p_student_id: 's' });
  });
  it('returns a missing error of the old signature for the legacy path, and other errors as they are', async () => {
    const rpc = vi.fn().mockResolvedValue(miss);
    expect((await saveMarkDoneEvaluationRpc({}, prior, rpc)).error).toBe(miss.error);
    __resetMarkDoneSaveForTests();
    const denied = { data: null, error: { code: '42501', message: 'no' } };
    const rpc2 = vi.fn().mockResolvedValue(denied);
    expect((await saveMarkDoneEvaluationRpc({}, prior, rpc2)).error).toBe(denied.error);
    // a rejected 7-argument call is retried once with the old signature (the prior verdict is optional)
    expect(rpc2).toHaveBeenCalledTimes(2);
  });
  it('a size or shape rejection of the prior verdict still saves with the old call and keeps using the new one', async () => {
    const tooBig = { data: null, error: { code: '22023', message: 'p_prior_verdict is too large' } };
    const rpc = vi.fn().mockResolvedValueOnce(tooBig).mockResolvedValueOnce({ data: 1, error: null }).mockResolvedValue({ data: 1, error: null });
    const res = await saveMarkDoneEvaluationRpc({ p_student_id: 's' }, prior, rpc);
    expect(res.error).toBeNull();
    expect(rpc.mock.calls[1][1]).toEqual({ p_student_id: 's' });
    await saveMarkDoneEvaluationRpc({ p_student_id: 's' }, prior, rpc);
    expect(rpc.mock.calls[2][1]).toEqual({ p_student_id: 's', p_prior_verdict: prior });
  });
  it('without a prior verdict calls the old signature directly', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    await saveMarkDoneEvaluationRpc({ p_student_id: 's' }, null, rpc);
    expect(rpc.mock.calls[0][1]).toEqual({ p_student_id: 's' });
  });
});
