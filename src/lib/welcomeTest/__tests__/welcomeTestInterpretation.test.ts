import { describe, it, expect } from 'vitest';
import {
  INTERPRETATION_VERSION,
  INTERPRETATION_VERSION_KEY,
  buildTraitEvidence,
  interpretationVersionOf,
} from '../../../../supabase/functions/_shared/welcomeTestInterpretation';
import { reconstructTraits, TRAIT_QUESTIONS } from '../../../../supabase/functions/_shared/welcomeTestTraits';
import { computeCalibratedSelfAwareness } from '../../../../supabase/functions/_shared/welcomeTestSignals';

const Q7_SELF_CRITICAL = 'I get very frustrated with myself';
const Q7_AVOID = 'I avoid speaking because I fear mistakes';
const Q4_ASK = 'I ask the person to repeat or explain';
const Q4_GUESS = 'I try to guess from context';

describe('interpretation version', () => {
  it('constants', () => {
    expect(INTERPRETATION_VERSION).toBe(2);
    expect(INTERPRETATION_VERSION_KEY).toBe('__interpretation_version__');
  });
  it('an unstamped or invalid profile is v1', () => {
    expect(interpretationVersionOf({})).toBe(1);
    expect(interpretationVersionOf(null)).toBe(1);
    expect(interpretationVersionOf({ [INTERPRETATION_VERSION_KEY]: 'x' })).toBe(1);
    expect(interpretationVersionOf({ [INTERPRETATION_VERSION_KEY]: 2 })).toBe(2);
    expect(interpretationVersionOf({ [INTERPRETATION_VERSION_KEY]: '2' })).toBe(2);
  });
});

describe('trait mapping corrections (interpretation v2)', () => {
  it('q7 "frustrated with myself" is self-criticism: medium in v2, high when rebuilding a v1 profile', () => {
    // CHANGED: v1 mapped this option to high anxiety.
    expect(reconstructTraits({ wt_q7: Q7_SELF_CRITICAL }).anxiety_level).toBe('medium');
    expect(reconstructTraits({ wt_q7: Q7_SELF_CRITICAL }, null, 1).anxiety_level).toBe('high');
    expect(reconstructTraits({ wt_q7: Q7_SELF_CRITICAL }, null, 2).anxiety_level).toBe('medium');
  });
  it('q7 fear of mistakes stays high in both versions', () => {
    expect(reconstructTraits({ wt_q7: Q7_AVOID }).anxiety_level).toBe('high');
    expect(reconstructTraits({ wt_q7: Q7_AVOID }, null, 1).anxiety_level).toBe('high');
  });
  it('q4 "ask to repeat" is help-seeking: medium in v2 (v1 high); guessing from context stays high', () => {
    // CHANGED: v1 mapped asking for clarification to high tolerance of ambiguity.
    expect(reconstructTraits({ wt_q4: Q4_ASK }).ambiguity_tolerance).toBe('medium');
    expect(reconstructTraits({ wt_q4: Q4_ASK }, null, 1).ambiguity_tolerance).toBe('high');
    expect(reconstructTraits({ wt_q4: Q4_GUESS }).ambiguity_tolerance).toBe('high');
    expect(reconstructTraits({ wt_q4: Q4_GUESS }, null, 1).ambiguity_tolerance).toBe('high');
  });
  it('every other option maps identically in v1 and v2', () => {
    for (const [trait, cfg] of Object.entries(TRAIT_QUESTIONS)) {
      if (trait === 'usage_context') continue;
      cfg.options.forEach((opt, i) => {
        const a = reconstructTraits({ [cfg.questionId]: opt }, null, 1)[trait];
        const b = reconstructTraits({ [cfg.questionId]: opt }, null, 2)[trait];
        const changed = (trait === 'anxiety_level' && i === 4) || (trait === 'ambiguity_tolerance' && i === 0);
        if (changed) expect(a).not.toBe(b); else expect(a).toBe(b);
      });
    }
  });
});

describe('buildTraitEvidence', () => {
  it('maps each reconstructed trait to its question id', () => {
    const ev = buildTraitEvidence({ wt_q7: Q7_AVOID, wt_q41b: "I'm learning English for the long term - there's no rush, but I want steady progress" });
    expect(ev).toEqual({
      anxiety_level: { question_id: 'wt_q7', single_item: true },
      learning_timeline: { question_id: 'wt_q41b', single_item: true },
    });
  });
  it('has no entry for unanswered or unmatched questions', () => {
    expect(buildTraitEvidence({})).toEqual({});
    expect(buildTraitEvidence(null)).toEqual({});
    expect(buildTraitEvidence({ wt_q7: 'not an option' })).toEqual({});
  });
  it('a trait with an answered partner item is not single_item', () => {
    const ev = buildTraitEvidence({
      wt_q5: "2-3 hours - I'm committed",
      wt_q5c: 'I do it carefully, even if it takes an hour',
      wt_q3: 'I need it for work: meetings, emails, presentations',
    });
    expect(ev.weekly_study_time).toEqual({ question_id: 'wt_q5', single_item: false });
    expect(ev.homework_commitment).toEqual({ question_id: 'wt_q5c', single_item: false });
    expect(ev.motivation_type).toEqual({ question_id: 'wt_q3', single_item: true });
  });
  it('covers exactly the reconstructed traits (answers only)', () => {
    const answers: Record<string, unknown> = {};
    for (const cfg of Object.values(TRAIT_QUESTIONS)) answers[cfg.questionId] = cfg.questionId === 'wt_q3b' ? [cfg.options[0]] : cfg.options[0];
    expect(Object.keys(buildTraitEvidence(answers)).sort()).toEqual(Object.keys(reconstructTraits(answers)).sort());
  });
});

describe('computeCalibratedSelfAwareness (A1-04)', () => {
  const idk = (itemLevel: string) => ({ itemLevel, outcome: 'idk' as const });
  const wrong = (itemLevel: string) => ({ itemLevel, outcome: 'wrong' as const });
  it("rewards I don't know above the level", () => {
    const r = computeCalibratedSelfAwareness([idk('C1'), idk('B2'), idk('C1')], 'B1');
    expect(r).toMatchObject({ score: 100, signals: 3, idk_above: 3 });
  });
  it("penalises I don't know below the level (under-confidence)", () => {
    expect(computeCalibratedSelfAwareness([idk('A1'), idk('A2'), idk('A1')], 'B1')?.score).toBe(0);
  });
  it('a wrong answer is credit 0 and IDK at the level is half credit', () => {
    const r = computeCalibratedSelfAwareness([idk('B1'), wrong('B2'), idk('C1'), wrong('C1')], 'B1');
    expect(r?.score).toBe(38); // (0.5 + 0 + 1 + 0) / 4
    expect(r).toMatchObject({ idk_at: 1, idk_above: 1, wrong: 2 });
  });
  it('is level-aware: the same counts score differently above vs below', () => {
    expect(computeCalibratedSelfAwareness([idk('C1'), wrong('A2'), wrong('A2')], 'B1')?.score).toBe(33);
    expect(computeCalibratedSelfAwareness([idk('A2'), wrong('A2'), wrong('A2')], 'B1')?.score).toBe(0);
  });
  it('returns null below 3 IDK+wrong signals, without an estimated level, and ignores correct items and unknown levels', () => {
    expect(computeCalibratedSelfAwareness([idk('C1'), wrong('C1')], 'B1')).toBeNull();
    expect(computeCalibratedSelfAwareness([idk('C1'), wrong('C1'), idk('C1')], null)).toBeNull();
    expect(computeCalibratedSelfAwareness([idk('C1'), wrong('C1'), { itemLevel: null, outcome: 'idk' }, { itemLevel: 'B1', outcome: 'correct' }], 'B1')).toBeNull();
    expect(computeCalibratedSelfAwareness(null, 'B1')).toBeNull();
  });
  it('accepts a half-step estimated level', () => {
    expect(computeCalibratedSelfAwareness([idk('B2'), idk('B1'), idk('C1')], 'B1-B2')?.score).toBe(67); // above, below, above
  });
});
