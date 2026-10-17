import { describe, it, expect } from 'vitest';
import {
  LEVEL_ALGORITHM_VERSION,
  LEVEL_VERSION_KEY,
  decideLevel,
  estimateLevel,
  levelForAverage,
  parseProfileModelOutput,
  storedLevelVersion,
} from '../../../../supabase/functions/_shared/welcomeTestLevel';
import { reconstructTraits } from '../../../../supabase/functions/_shared/welcomeTestTraits';
import { regradeQuestionRows } from '../../../../supabase/functions/_shared/welcomeTestKeyedAnswer';

describe('estimateLevel', () => {
  it('uses the thresholds of the inline version (90/75/55/35)', () => {
    expect(levelForAverage(95)).toBe('C1');
    expect(levelForAverage(90)).toBe('C1');
    expect(levelForAverage(80)).toBe('B2');
    expect(levelForAverage(60)).toBe('B1');
    expect(levelForAverage(40)).toBe('A2');
    expect(levelForAverage(20)).toBe('A1');
  });
  it('is the mean of the skills that have a score', () => {
    const r = estimateLevel({ grammar: 80, vocabulary: 60, reading: null, writing: undefined, selfAssessedLevel: 'B1-B2' });
    expect(r.averageScore).toBe(70);
    expect(r.scoredSkills).toEqual(['grammar', 'vocabulary']);
    expect(r.level).toBe('B1');
  });
  it('returns null (no fake A1) when nothing is scored', () => {
    const r = estimateLevel({ grammar: null, vocabulary: null, reading: null, writing: null, selfAssessedLevel: 'B2-C1' });
    expect(r.level).toBeNull();
    expect(r.confidence).toBeNull();
    expect(r.averageScore).toBeNull();
  });
  it('a real 0% is a score, not missing data', () => {
    const r = estimateLevel({ grammar: 0, vocabulary: null, reading: null, writing: null, selfAssessedLevel: null });
    expect(r.level).toBe('A1');
  });
  it('confidence is not "accurate" when the self-assessed level is missing or unknown', () => {
    expect(estimateLevel({ grammar: 60, vocabulary: 60, reading: 60, writing: 60, selfAssessedLevel: null }).confidence).toBeNull();
    expect(estimateLevel({ grammar: 60, vocabulary: 60, reading: 60, writing: 60, selfAssessedLevel: 'unknown' }).confidence).toBeNull();
  });
  it('confidence compares the self-assessed and the estimated level (0.5 tolerance)', () => {
    const base = { grammar: 60, vocabulary: 60, reading: 60, writing: 60 }; // B1
    expect(estimateLevel({ ...base, selfAssessedLevel: 'B1-B2' }).confidence).toBe('accurate');
    expect(estimateLevel({ ...base, selfAssessedLevel: 'C1-C2' }).confidence).toBe('overestimates');
    expect(estimateLevel({ ...base, selfAssessedLevel: 'A1-A2' }).confidence).toBe('underestimates');
  });
  it('the final writing score (after AI scoring) changes the level, which is why it is computed last', () => {
    const before = estimateLevel({ grammar: 55, vocabulary: 55, reading: 55, writing: null, selfAssessedLevel: null });
    const after = estimateLevel({ grammar: 55, vocabulary: 55, reading: 55, writing: 10, selfAssessedLevel: null });
    expect(before.level).toBe('B1');
    expect(after.level).toBe('A2');
  });
});

describe('decideLevel (force re-run keeps stored levels of another algorithm version)', () => {
  const computed = estimateLevel({ grammar: 95, vocabulary: 95, reading: 95, writing: 95, selfAssessedLevel: 'C1-C2' });
  const stored = { estimated_level: 'B1', level_confidence: 'overestimates', raw_answers: {} };

  it('new runs always use the computed level and stamp the version', () => {
    const d = decideLevel(computed, { force: false, sameAttempt: false, previous: stored });
    expect(d).toEqual({ level: 'C1', confidence: computed.confidence, keptStored: false, stampVersion: LEVEL_ALGORITHM_VERSION });
  });
  it('a retry of the same attempt without force recomputes', () => {
    expect(decideLevel(computed, { force: false, sameAttempt: true, previous: stored }).level).toBe('C1');
  });
  it('force on an unstamped (version 1) stored profile keeps level and confidence and leaves the stamp alone', () => {
    const d = decideLevel(computed, { force: true, sameAttempt: true, previous: stored });
    expect(d).toEqual({ level: 'B1', confidence: 'overestimates', keptStored: true, stampVersion: null });
  });
  it('force on a profile stamped with the current version recomputes', () => {
    const prev = { ...stored, raw_answers: { [LEVEL_VERSION_KEY]: LEVEL_ALGORITHM_VERSION } };
    expect(decideLevel(computed, { force: true, sameAttempt: true, previous: prev }).level).toBe('C1');
  });
  it('force on a profile of another attempt recomputes', () => {
    expect(decideLevel(computed, { force: true, sameAttempt: false, previous: stored }).level).toBe('C1');
  });
  it('force with no stored level computes', () => {
    expect(decideLevel(computed, { force: true, sameAttempt: true, previous: { raw_answers: {} } }).level).toBe('C1');
  });
  it('storedLevelVersion treats a missing or invalid stamp as 1', () => {
    expect(storedLevelVersion(null)).toBe(1);
    expect(storedLevelVersion({ raw_answers: { [LEVEL_VERSION_KEY]: 'x' } })).toBe(1);
    expect(storedLevelVersion({ raw_answers: { [LEVEL_VERSION_KEY]: 2 } })).toBe(2);
  });
});

describe('parseProfileModelOutput', () => {
  const ok = { summary: 'Short.', recommendations: ['a'], writing_quality: 'basic', key_observations: ['b'], per_question_scores: { wt_q16: 45 } };
  it('accepts a valid reply, also when wrapped in text', () => {
    const r = parseProfileModelOutput('Here you go:\n' + JSON.stringify(ok));
    expect(r.profile).toEqual(ok);
    expect(r.scores).toEqual({ wt_q16: 45 });
  });
  it('fills optional fields', () => {
    const r = parseProfileModelOutput(JSON.stringify({ summary: 'x' }));
    expect(r.profile).toEqual({ summary: 'x', recommendations: [], writing_quality: 'unknown', key_observations: [], per_question_scores: {} });
  });
  it('rejects non-JSON, a missing or empty summary and wrongly typed fields (no garbage stored)', () => {
    for (const bad of [
      'not json at all',
      '',
      JSON.stringify({ recommendations: ['a'] }),
      JSON.stringify({ summary: '  ' }),
      JSON.stringify({ summary: 5 }),
      JSON.stringify({ summary: 'x', recommendations: 'one' }),
      JSON.stringify({ summary: 'x', recommendations: [1] }),
      JSON.stringify({ summary: 'x', key_observations: [{}] }),
      JSON.stringify({ summary: 'x', writing_quality: 3 }),
      JSON.stringify({ summary: 'x', per_question_scores: [1] }),
      '[1,2]',
    ]) {
      expect(parseProfileModelOutput(bad).profile).toBeNull();
    }
    expect(parseProfileModelOutput(undefined).profile).toBeNull();
  });
  it('still hands back the score object when only the text is invalid', () => {
    const r = parseProfileModelOutput(JSON.stringify({ summary: 7, per_question_scores: { wt_q16: 30 } }));
    expect(r.profile).toBeNull();
    expect(r.scores).toEqual({ wt_q16: 30 });
  });
});

describe('reconstructTraits usage_context (multi-select q3b)', () => {
  it('joins the mapped values with ", "', () => {
    expect(reconstructTraits({ wt_q3b: ['At work - emails, meetings, calls', 'Online - social media, forums, gaming'] }).usage_context)
      .toBe('work_formal, online_informal');
  });
  it('skips unknown options and sets nothing when none resolves', () => {
    expect(reconstructTraits({ wt_q3b: ['At work - emails, meetings, calls', 'nonsense'] }).usage_context).toBe('work_formal');
    expect(reconstructTraits({ wt_q3b: ['nonsense'] }).usage_context).toBeUndefined();
    expect(reconstructTraits({ wt_q3b: [] }).usage_context).toBeUndefined();
  });
  it('the client detected_traits value still fills it when the answers do not resolve', () => {
    expect(reconstructTraits({}, { usage_context: 'travel' }).usage_context).toBe('travel');
  });
});

describe('level evidence gate (version 3)', () => {
  const scores = { grammar: 90, vocabulary: 90, reading: 100, writing: null, selfAssessedLevel: 'B2' };

  it('gives no level for one answered item (forged C1 case)', () => {
    const r = estimateLevel({ ...scores, evidence: { scoredItems: 1, answeredItems: 1 } });
    expect(r.level).toBeNull();
    expect(r.confidence).toBeNull();
    expect(r.evidence?.status).toBe('insufficient');
  });

  it('gives no level when almost everything is "I don\'t know"', () => {
    const r = estimateLevel({ grammar: 0, vocabulary: 0, reading: 0, writing: null, selfAssessedLevel: null, evidence: { scoredItems: 20, answeredItems: 0 } });
    expect(r.level).toBeNull();
    expect(r.evidence).toMatchObject({ status: 'insufficient', scored_items: 20, answered_items: 0 });
  });

  it('needs two scored skills', () => {
    const r = estimateLevel({ grammar: 80, vocabulary: null, reading: null, writing: null, selfAssessedLevel: null, evidence: { scoredItems: 9, answeredItems: 9 } });
    expect(r.level).toBeNull();
    expect(r.evidence?.scored_skills).toBe(1);
  });

  it('levels a student with enough evidence', () => {
    const r = estimateLevel({ ...scores, evidence: { scoredItems: 18, answeredItems: 15 } });
    expect(r.level).toBe('C1');
    expect(r.evidence?.status).toBe('ok');
    expect(r.version).toBe(LEVEL_ALGORITHM_VERSION);
  });
});

describe('server re-grading of stored rows', () => {
  it('grades keyed rows from the stored key and clears client verdicts on open and unanswered rows', () => {
    const changes = regradeQuestionRows([
      { id: 'a', question_type: 'fill_blank', element_type: 'grammar', correct_answer: 'goes', student_answer: 'gos', is_correct: true },
      { id: 'b', question_type: 'multiple_choice', element_type: 'reading', correct_answer: 'B', student_answer: 'B', is_correct: false },
      { id: 'c', question_type: 'open_ended', element_type: 'writing', correct_answer: '', student_answer: 'Some text', is_correct: true },
      { id: 'd', question_type: 'multiple_choice', element_type: 'grammar', correct_answer: 'A', student_answer: null, is_correct: true },
      { id: 'e', question_type: 'multiple_choice', element_type: 'grammar', correct_answer: 'A', student_answer: '__IDK__', is_correct: false },
      { id: 'f', question_type: 'fill_blank', element_type: 'grammar', correct_answer: ['have been studying', 'have studied'], student_answer: 'Have studied.', is_correct: null },
    ]);
    expect(changes).toEqual([
      { id: 'a', is_correct: false },
      { id: 'b', is_correct: true },
      { id: 'c', is_correct: null },
      { id: 'd', is_correct: null },
      { id: 'f', is_correct: true },
    ]);
  });
});
