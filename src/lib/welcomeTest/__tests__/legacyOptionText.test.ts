import { describe, it, expect } from 'vitest';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';
import { TRAIT_QUESTIONS, reconstructTraits } from '../../../../supabase/functions/_shared/welcomeTestTraits';
import { computeLearningPathScore } from '../../../../supabase/functions/_shared/learningPathScore';
import {
  LEGACY_OPTION_TEXT,
  matchOptionIndex,
  normalizeOptionText,
} from '../../../../supabase/functions/_shared/welcomeTestOptionAliases';

const byId = new Map(ALL_WELCOME_TEST_QUESTIONS.map((q) => [q.id, q as { options?: string[] }]));
const legacy = Object.entries(LEGACY_OPTION_TEXT).flatMap(([qid, m]) => Object.entries(m).map(([oldText, newText]) => ({ qid, oldText, newText })));
const traitOf = (qid: string) => Object.entries(TRAIT_QUESTIONS).find(([, c]) => c.questionId === qid);

describe('legacy Welcome Test option text (bf57f19)', () => {
  it('covers the six em dash edits and the older wordings found by the D15 dry run', () => {
    const emDash = legacy.filter((l) => l.oldText.includes('\u2014'));
    expect(emDash).toHaveLength(6);
    expect(legacy.length - emDash.length).toBe(13);
    for (const l of legacy.filter((x) => !x.oldText.includes('\u2014'))) expect(['wt_q1', 'wt_q3', 'wt_q7']).toContain(l.qid);
  });

  it.each(legacy)('alias target exists in the current question options: $qid', ({ qid, newText }) => {
    expect(byId.get(qid)?.options).toContain(newText);
  });

  it.each(legacy)('reconstructTraits: old text equals current text for $qid', ({ qid, oldText, newText }) => {
    const entry = traitOf(qid);
    if (!entry) return; // q5c, q7, q13c are not in TRAIT_QUESTIONS here: covered by matchOptionIndex below
    expect(reconstructTraits({ [qid]: oldText })).toEqual(reconstructTraits({ [qid]: newText }));
    expect(Object.keys(reconstructTraits({ [qid]: oldText }))).toContain(entry[0]);
  });

  it.each(legacy)('matchOptionIndex resolves old and new text to the same index: $qid', ({ qid, oldText, newText }) => {
    const options = byId.get(qid)!.options!;
    const i = matchOptionIndex(qid, options, oldText);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBe(matchOptionIndex(qid, options, newText));
    expect(i).toBe(options.indexOf(newText));
  });

  it('computeLearningPathScore is equal for old vs new text on every legacy answer', () => {
    const oldA: Record<string, unknown> = {};
    const newA: Record<string, unknown> = {};
    for (const l of legacy) { oldA[l.qid] = l.oldText; newA[l.qid] = l.newText; }
    const tOld = reconstructTraits(oldA);
    const tNew = reconstructTraits(newA);
    expect(tOld).toEqual(tNew);
    expect(computeLearningPathScore(tOld, oldA)).toEqual(computeLearningPathScore(tNew, newA));
  });

  it('fallback normalisation tolerates spacing and dash variants, on both sides', () => {
    const options = TRAIT_QUESTIONS.motivation_type.options;
    expect(matchOptionIndex('wt_q3', options, '  I need it for work \u2014  meetings, emails, presentations ')).toBe(0);
    expect(matchOptionIndex('wt_q3', options, 'I want to travel   and talk freely')).toBe(2);
    expect(matchOptionIndex('wt_q3', options, 'something else')).toBe(-1);
    expect(normalizeOptionText('a \u2014 b')).toBe(normalizeOptionText('a - b'));
  });

  it('normalisation creates no collisions inside any question options', () => {
    for (const q of ALL_WELCOME_TEST_QUESTIONS as Array<{ id: string; options?: unknown[] }>) {
      const opts = (q.options || []).filter((o): o is string => typeof o === 'string');
      expect(new Set(opts.map(normalizeOptionText)).size, q.id).toBe(opts.length);
    }
  });
});
