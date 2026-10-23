import { describe, it, expect } from 'vitest';
import { buildHomeworkDelta, parseAiEvaluations } from '../deltaSave';

const exercise = {
  type: 'fill-in-blanks',
  sentences: [
    { text: 'a ___', answer: 'x', nano_skill: { name: 'ns.A1.grammar.skill_a', reason: 'r' } },
    { text: 'b ___', answer: 'y', nano_skill: { name: 'ns.A1.grammar.skill_b', reason: 'r' } },
    { text: 'c ___', answer: 'z', nano_skill: { name: 'ns.A1.grammar.skill_c', reason: 'r' } },
  ],
};

const base = { exerciseData: exercise, exerciseType: 'fill-in-blanks', audio: {} };

describe('buildHomeworkDelta', () => {
  it('is null when nothing changed (a blur must write nothing)', () => {
    expect(buildHomeworkDelta({ ...base, answers: { 0: 'x', 1: 'y' }, dirtyKeys: [], dirtyAudio: [] })).toBeNull();
  });

  it('sends only the changed keys, not the whole exercise snapshot', () => {
    const d = buildHomeworkDelta({ ...base, answers: { 0: 'x', 1: 'y', 2: 'z' }, dirtyKeys: ['1'], dirtyAudio: [] })!;
    expect(d.answers).toEqual({ 1: 'y' });
    expect(d.keys).toEqual(['1']);
  });

  it('rates only the questions of the changed keys', () => {
    const d = buildHomeworkDelta({ ...base, answers: { 0: 'x', 1: 'wrong', 2: 'z' }, dirtyKeys: ['1'], dirtyAudio: [] })!;
    expect(d.itemEvaluations?.map((e) => e.question_index)).toEqual([1]);
    expect(d.itemEvaluations?.[0].name).toBe('ns.A1.grammar.skill_b');
  });

  it('sends a cleared answer as an empty value and no rating (the server drops the old one)', () => {
    const d = buildHomeworkDelta({ ...base, answers: { 0: '', 1: 'y' }, dirtyKeys: ['0'], dirtyAudio: [] })!;
    expect(d.answers).toEqual({ 0: '' });
    expect(d.itemEvaluations).toBeNull();
  });

  it('maps multi-blank keys (3_1) to their question', () => {
    const d = buildHomeworkDelta({ ...base, answers: { '2_0': 'z', '2_1': 'z' }, dirtyKeys: ['2_1'], dirtyAudio: [] })!;
    expect(d.answers).toEqual({ '2_1': 'z' });
    expect(d.itemEvaluations?.every((e) => e.question_index === 2)).toBe(true);
  });

  it('carries only the changed recordings', () => {
    const d = buildHomeworkDelta({
      ...base, answers: {}, audio: { 0: 'https://a', 1: 'https://b' }, dirtyKeys: [], dirtyAudio: [1],
    })!;
    expect(d.audio).toEqual({ 1: 'https://b' });
    expect(d.audioKeys).toEqual([1]);
  });
});

describe('parseAiEvaluations', () => {
  it('reads question evaluations by exercise and question', () => {
    const out = parseAiEvaluations([
      { exercise_index: 2, ai_evaluation: { question_evaluations: [{ question_index: 0, quality_score: 0.9 }, { question_index: 3, quality_score: 0.1 }] } },
      { exercise_index: 4, ai_evaluation: null },
    ]);
    expect(Object.keys(out)).toEqual(['2']);
    expect(out[2][3].quality_score).toBe(0.1);
  });

  it('reads the legacy single evaluation as question 0', () => {
    const out = parseAiEvaluations([{ exercise_index: 1, ai_evaluation: { is_acceptable: true, quality_score: 1 } }]);
    expect(out[1][0].quality_score).toBe(1);
  });

  it('tolerates no rows', () => {
    expect(parseAiEvaluations(null)).toEqual({});
  });
});
