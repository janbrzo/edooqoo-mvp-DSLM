import { describe, it, expect } from 'vitest';
import live from './liveStudentAnswers.json';
import {
  applyExtraAliases,
  classifyProfile,
  findUnmatchedAnswers,
  recomputeProfile,
  renderMarkdown,
  resolveAnswers,
  summarize,
} from '../../../../scripts/dslm/profileV2Recompute';
import { reconstructTraits } from '../../../../supabase/functions/_shared/welcomeTestTraits';
import { computeLearningPathScore } from '../../../../supabase/functions/_shared/learningPathScore';

const LIVE = live as Record<string, unknown>;
const EM = '—';
const FULL_ID = '4992288d-7ec7-44e4-8f74-f40bf8d1806a';

const legacyProfile = (raw: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  student_id: FULL_ID,
  estimated_level: 'A2',
  self_assessed_level: null,
  level_confidence: null,
  anxiety_level: 'medium',
  error_attitude: 'cautious',
  weekly_study_time: '1_hour',
  raw_answers: raw,
  traits: null,
  learning_path: null,
  ...extra,
});

describe('classifyProfile', () => {
  it('separates missing columns, pre Stage 4 and current', () => {
    expect(classifyProfile({ traits: null, learning_path: null })).toBe('missing_v2_columns');
    expect(classifyProfile({ traits: { version: 1 }, learning_path: { version: 2 }, raw_answers: {} })).toBe('pre_stage4');
    expect(classifyProfile({
      traits: { version: 1, __interpretation_version__: 2 },
      learning_path: { version: 3 },
      raw_answers: { trait_evidence: {} },
    })).toBe('current');
    expect(classifyProfile({
      traits: { version: 1, __interpretation_version__: 2 },
      learning_path: { version: 3 },
      raw_answers: {},
    })).toBe('pre_stage4');
  });
});

describe('resolveAnswers', () => {
  it('rebuilds a known bank from the stored rows', () => {
    const r = resolveAnswers({
      profile: legacyProfile({ wt_q1: 'ignored' }),
      test: { total_questions: 58 },
      rows: [{ question_index: 3, student_answer: ['Traveling - airports, hotels, restaurants'] }],
    });
    expect(r.source).toBe('rows');
    expect(Object.keys(r.answers)).toEqual(['wt_q3b']);
  });
  it('uses the stored wt_* keys of a legacy test size', () => {
    const r = resolveAnswers({
      profile: legacyProfile({ wt_q1: LIVE.wt_q1, not_an_answer: 1 }),
      test: { total_questions: 49 },
      rows: [{ question_index: 0, student_answer: 'x' }],
    });
    expect(r.source).toBe('raw_answers');
    expect(Object.keys(r.answers)).toEqual(['wt_q1']);
  });
  it('reports none when nothing is stored', () => {
    expect(resolveAnswers({ profile: legacyProfile({}), test: null, rows: [] })).toEqual({ answers: {}, source: 'none' });
  });
});

describe('findUnmatchedAnswers (legacy alias problem)', () => {
  it('flags a stored text that matches no option', () => {
    expect(findUnmatchedAnswers({ wt_q1: 'Some text that was never an option' })).toEqual(['wt_q1']);
  });
  it('accepts current text, a registered alias, I do not know and blanks', () => {
    expect(findUnmatchedAnswers({
      wt_q1: LIVE.wt_q1,
      wt_q3: `I need it for work ${EM} meetings, emails, presentations`,
      wt_q7: '__IDK__',
      wt_q9: '',
    })).toEqual([]);
  });
  it('checks every element of a multi-select', () => {
    expect(findUnmatchedAnswers({ wt_q10: ['Private lessons with a teacher', 'Old removed option'] })).toEqual(['wt_q10']);
  });
});

describe('applyExtraAliases (what-if only)', () => {
  it('makes a legacy text resolve and restores the table afterwards', () => {
    const legacy = 'Old wording of the first option';
    const current = 'I can do basic things, like ordering food or asking for directions';
    expect(findUnmatchedAnswers({ wt_q1: legacy })).toEqual(['wt_q1']);
    const restore = applyExtraAliases({ wt_q1: { [legacy]: current } });
    expect(findUnmatchedAnswers({ wt_q1: legacy })).toEqual([]);
    restore();
    expect(findUnmatchedAnswers({ wt_q1: legacy })).toEqual(['wt_q1']);
  });
});

describe('recomputeProfile', () => {
  const answers = { ...LIVE };
  const entry = () => ({ profile: legacyProfile(answers), test: { total_questions: 49 }, rows: [] as any[] });

  it('uses the shared code: traits and Learning Path v3 equal a direct call', () => {
    const r = recomputeProfile(entry());
    expect(r.tier).toBe('missing_v2_columns');
    expect(r.interpretationVersion).toBe(1);
    const traits = reconstructTraits(answers, null, 1);
    expect(r.after.traits).toMatchObject({ version: 1, ...traits });
    expect(r.after.traits).not.toHaveProperty('__interpretation_version__');
    expect(r.after.learning_path).toEqual(computeLearningPathScore(traits, answers));
    expect((r.after.learning_path as any).version).toBe(3);
    expect(r.after.signal_coverage).toBe((r.after.learning_path as any).coverage);
    expect(r.columnChange.traits).toBe('set');
  });

  it('never mutates its input', () => {
    const e = entry();
    const before = JSON.stringify(e);
    recomputeProfile(e);
    expect(JSON.stringify(e)).toBe(before);
  });

  it('flags a changed prompt intensity against the stored v1 path', () => {
    const lp = computeLearningPathScore(reconstructTraits(answers, null, 1), answers);
    const other = lp.path === 'target' ? 'comfort' : 'target';
    const r = recomputeProfile({
      profile: legacyProfile({ ...answers, learning_path: { score: 90, path: other } }),
      test: { total_questions: 49 },
      rows: [],
    });
    expect(r.before.intensity).toBe(other);
    expect(r.intensityChanged).toBe(true);
    expect(summarize([r]).intensityChanged).toBe(1);
  });

  it('marks a profile unsafe when a stored answer matches no option', () => {
    const r = recomputeProfile({
      profile: legacyProfile({ ...answers, wt_q3: 'A sentence from an older wording of this question' }),
      test: { total_questions: 49 },
      rows: [],
    });
    expect(r.unmatched).toEqual(['wt_q3']);
    expect(r.unsafe).toBe(true);
  });

  it('reproduces a stored v2 path with version 2 on a pre Stage 4 profile', () => {
    const traits = reconstructTraits(answers, null, 1);
    const v2 = computeLearningPathScore(traits, answers, { version: 2 });
    const r = recomputeProfile({
      profile: legacyProfile(answers, { traits: { version: 1, ...traits }, learning_path: v2, raw_answers: answers }),
      test: { total_questions: 49 },
      rows: [],
    });
    expect(r.tier).toBe('pre_stage4');
    expect(r.v2Reproduced).toBe(true);
    expect(r.columnChange.learning_path).toBe('changed');
    expect(r.columnChange.traits).toBe('same');
  });

  it('reports the interpretation v2 alternative without applying it', () => {
    const r = recomputeProfile(entry());
    expect(r.currentInterpretationAlt).not.toBeNull();
    expect(r.interpretationVersion).toBe(1);
  });
});

describe('renderMarkdown', () => {
  it('prints shortened ids and no email or name', () => {
    const r = recomputeProfile({ profile: legacyProfile({ ...LIVE }), test: { total_questions: 49 }, rows: [] });
    const md = renderMarkdown([r], 'test run');
    expect(md).toContain('| 4992288d |');
    expect(md).not.toContain(FULL_ID);
    expect(md).not.toMatch(/@/);
    expect(md).toContain('Dry run, nothing written');
    expect(md).not.toContain('—');
  });
});
