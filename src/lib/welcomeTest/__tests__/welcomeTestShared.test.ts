import { describe, it, expect } from 'vitest';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';
import {
  WELCOME_TEST_QUESTION_IDS,
  TRAIT_QUESTIONS,
  answersFromQuestionRows,
  reconstructTraits,
} from '../../../../supabase/functions/_shared/welcomeTestTraits';
import { computeLearningPathScore, pathForScore, studyCapacity, Q3B_OPTIONS, Q9_OPTIONS, Q10_OPTIONS } from '../../../../supabase/functions/_shared/learningPathScore';
import { answerBehaviour, computeDivergences } from '../../../../supabase/functions/_shared/welcomeTestSignals';

const byId = new Map(ALL_WELCOME_TEST_QUESTIONS.map((q) => [q.id, q]));

describe('Welcome Test shared tables match the question bank', () => {
  it('question ids follow ALL_WELCOME_TEST_QUESTIONS order', () => {
    expect(WELCOME_TEST_QUESTION_IDS).toEqual(ALL_WELCOME_TEST_QUESTIONS.map((q) => q.id));
  });

  it.each(Object.entries(TRAIT_QUESTIONS))('trait %s uses the exact option strings of its question', (_trait, cfg) => {
    const q = byId.get(cfg.questionId) as { options?: unknown[] } | undefined;
    expect(q, cfg.questionId).toBeDefined();
    expect(q!.options).toEqual(cfg.options);
  });

  it.each(Object.entries(TRAIT_QUESTIONS))('trait %s maps options like the client detected_trait', (trait, cfg) => {
    const q = byId.get(cfg.questionId) as { detected_trait?: { trait_name?: string; mapping?: Record<string, string> } } | undefined;
    if (!q?.detected_trait?.mapping) return; // traits the client does not detect itself
    expect(q.detected_trait.trait_name).toBe(trait);
    expect(Object.fromEntries(Object.entries(q.detected_trait.mapping).map(([k, v]) => [String(k), v]))).toEqual(cfg.mapping);
  });

  it('LPS option lists and confidence matrix labels match the question bank', () => {
    expect((byId.get('wt_q3b') as any).options).toEqual(Q3B_OPTIONS);
    expect((byId.get('wt_q9') as any).options).toEqual(Q9_OPTIONS);
    expect((byId.get('wt_q10') as any).options).toEqual(Q10_OPTIONS);
    const matrix = (byId.get('wt_q44') as any).matrix_items as string[];
    for (const label of ['Speaking with strangers', 'Writing formal emails', 'Reading news articles']) {
      expect(matrix).toContain(label);
    }
  });

  it('force re-run rebuilds answers under the real ids (not wt_q{index+1})', () => {
    const idx = WELCOME_TEST_QUESTION_IDS.indexOf('wt_q5c');
    const answers = answersFromQuestionRows([
      { question_index: idx, student_answer: 'I start it but stop after about 10 minutes' },
      { question_index: 0, student_answer: null },
    ]);
    expect(answers).toEqual({ wt_q5c: 'I start it but stop after about 10 minutes' });
    expect(reconstructTraits(answers).homework_commitment).toBe('low');
  });

  it('client detected_traits fill only what the answers do not resolve', () => {
    const t = reconstructTraits({ wt_q7: 'I do not mind; that is how you learn' }, { anxiety_level: 'high', latent_goal: 'lifestyle' });
    expect(t).toEqual({ anxiety_level: 'low', latent_goal: 'lifestyle' });
  });
});

describe('Learning Path Score v2', () => {
  it('missing signals are not scored as 50: weights renormalise and coverage reports it', () => {
    const lp = computeLearningPathScore({ learning_timeline: 'long_term_steady' }, {});
    expect(lp.score).toBe(25);
    expect(lp.coverage).toBe(0.15);
    expect(lp.component_scores.persistence_level).toBeNull();
    // CHANGED: LPS is v3 by default (v2 stays reproducible with { version: 2 }).
    expect(lp.version).toBe(3);
    expect(computeLearningPathScore({ learning_timeline: 'long_term_steady' }, {}, { version: 2 }).version).toBe(2);
  });

  it('no signal at all gives no score', () => {
    const lp = computeLearningPathScore({}, null);
    expect(lp.score).toBeNull();
    expect(lp.path).toBeNull();
  });

  it('scenario items weigh twice the direct ones (q3c with q3, q5c with q5)', () => {
    const lp = computeLearningPathScore({ motivation_type: 'integrative', latent_goal: 'career_critical' }, {});
    expect(lp.component_scores.motivation_type).toBe(Math.round((30 + 2 * 75) / 3));
    const cap = computeLearningPathScore({ weekly_study_time: '3_plus_hours', homework_commitment: 'avoidant' }, {});
    expect(cap.component_scores.weekly_study_time).toBe(Math.round((90 + 2 * 10) / 3));
  });

  it('audit case (v2): no study time + urgent critical goal is capped at accelerated with a warning (D4)', () => {
    const lp = computeLearningPathScore({
      weekly_study_time: 'none', homework_commitment: 'pragmatic', anxiety_level: 'low',
      learning_timeline: 'urgent_specific', career_english_importance: 'critical',
      plateau_response: 'intensity_response', persistence_level: 'high',
    }, {}, { version: 2 });
    expect(lp.capacity).toBe('low');
    expect(lp.score).toBe(75);
    expect(lp.path).toBe('accelerated');
    expect(lp.capacity_warning).toBe('unrealistic_goal');
    expect(lp.overrides_applied).toContain('low_capacity_cap');
  });

  it('v3: the same audit case is capped at guided (50): urgency never lifts the cap above capacity', () => {
    const lp = computeLearningPathScore({
      weekly_study_time: 'none', homework_commitment: 'pragmatic', anxiety_level: 'low',
      learning_timeline: 'urgent_specific', career_english_importance: 'critical',
      plateau_response: 'intensity_response', persistence_level: 'high',
    }, {});
    expect(lp.version).toBe(3);
    expect(lp.need).toBe('high');
    expect(lp.capacity).toBe('low');
    expect(lp.capacity_cap).toBe(50);
    expect(lp.score).toBeLessThanOrEqual(50);
    expect(lp.path).toBe('guided');
    expect(lp.capacity_warning).toBe('unrealistic_goal');
  });

  it('v3 has no urgency floors: urgent + critical does not lift a low weighted score to 85, urgent + low persistence not to 70', () => {
    const floorCase = { learning_timeline: 'urgent_specific', career_english_importance: 'critical', anxiety_level: 'high', persistence_level: 'low', reading_strategy: 'struggles_translates' };
    expect(computeLearningPathScore(floorCase, {}, { version: 2 }).overrides_applied).toContain('urgent_critical_override');
    const v3 = computeLearningPathScore(floorCase, {});
    expect(v3.overrides_applied).not.toContain('urgent_critical_override');
    expect(v3.overrides_applied).not.toContain('urgent_lazy_override');
    expect(v3.score).toBeLessThan(85);
  });

  it('v3 B1 persona (avoidant homework, low persistence, urgent + critical) lands in guided with the unrealistic_goal warning', () => {
    const lp = computeLearningPathScore({
      weekly_study_time: '2_3_hours', homework_commitment: 'avoidant', persistence_level: 'low',
      learning_timeline: 'urgent_specific', career_english_importance: 'critical', deadline_response: 'intense_preparation',
    }, {});
    expect(lp.capacity).toBe('low'); // q5c overrides the declared 2-3 hours
    expect(lp.path).toBe('guided');
    expect(lp.score).toBeLessThanOrEqual(50);
    expect(lp.capacity_warning).toBe('unrealistic_goal');
  });

  it('v3 capacity: low persistence alone lowers capacity unless committed time and good homework both say otherwise', () => {
    expect(studyCapacity({ weekly_study_time: '1_hour', homework_commitment: 'pragmatic', persistence_level: 'low' })).toBe('low');
    expect(studyCapacity({ weekly_study_time: '3_plus_hours', homework_commitment: 'proactive', persistence_level: 'low' })).toBe('normal');
    expect(studyCapacity({ weekly_study_time: '3_plus_hours', homework_commitment: 'proactive', persistence_level: 'high' })).toBe('high');
    expect(studyCapacity({ weekly_study_time: '1_hour', persistence_level: 'low' }, 2)).toBe('normal'); // v2 ignored persistence
  });

  it('v3 counts the q4/q14 scenario once: ambiguity_tolerance is not scored, error_attitude is', () => {
    const lp = computeLearningPathScore({ ambiguity_tolerance: 'low', error_attitude: 'comfortable' }, {});
    expect(lp.component_scores.ambiguity_tolerance).toBeNull();
    expect(lp.component_scores.error_attitude).toBe(75);
    expect(lp.coverage).toBe(0.05);
  });

  it('low capacity without urgency is capped at guided, without the urgency warning', () => {
    const lp = computeLearningPathScore({
      weekly_study_time: '2_3_hours', homework_commitment: 'avoidant',
      learning_timeline: 'ongoing_important', career_english_importance: 'moderate', persistence_level: 'high',
      deadline_response: 'intense_preparation',
    }, {});
    // CHANGED: career 'critical' is now a high NEED and warns in v3, so this case uses 'moderate' to stay warning-free.
    expect(lp.capacity).toBe('low');
    expect(lp.score).toBeLessThanOrEqual(50);
    expect(lp.capacity_warning).toBeNull();
  });

  it('path thresholds are unchanged', () => {
    expect([pathForScore(25), pathForScore(26), pathForScore(51), pathForScore(76)]).toEqual(['comfort', 'guided', 'accelerated', 'target']);
  });
});

describe('Welcome Test signals', () => {
  it('answer behaviour counts skips, I don\'t know, median time and rushed answers on skill items', () => {
    const b = answerBehaviour([
      { element_type: 'grammar', student_answer: 'went', time_spent_seconds: 2 },
      { element_type: 'grammar', student_answer: '__IDK__', time_spent_seconds: 5 },
      { element_type: 'vocabulary', student_answer: null },
      { element_type: 'reading', student_answer: 'B', time_spent_seconds: 10 },
      { element_type: 'writing', student_answer: null },
    ]);
    expect(b).toEqual({
      keyed_total: 4, keyed_answered: 3, skip_count_skill: 1, idk_count_skill: 1,
      coverage: 0.75, median_seconds_keyed: 6, rushed_count: 1,
    });
  });

  it('divergences flag declared vs measured disagreements only', () => {
    const d = computeDivergences({
      traits: {
        motivation_type: 'integrative', latent_goal: 'career_critical',
        weekly_study_time: '2_3_hours', homework_commitment: 'low',
        anxiety_level: 'low', deadline_response: 'avoidance',
      },
      estimatedLevel: 'A2',
      selfAssessedLevel: 'B2-C1',
      confidenceMatrix: { 'Reading news articles': 5, 'Writing formal emails': 3 },
      readingScore: 30,
      writingScore: 50,
      selfAwarenessScore: 10,
      skillWrongOrIdk: 5,
    });
    const pairs = d.map((x) => x.pair);
    expect(pairs).toEqual(['level', 'motivation', 'capacity', 'confidence_reading', 'anxiety', 'metacognition']);
    expect(d.find((x) => x.pair === 'level')!.severity).toBe('strong');
    expect(d.find((x) => x.pair === 'confidence_reading')!.gap).toBe(70);
  });

  it('a consistent learner has no divergences', () => {
    expect(computeDivergences({
      traits: { motivation_type: 'instrumental', latent_goal: 'career_critical', weekly_study_time: '1_hour', homework_commitment: 'high', anxiety_level: 'medium' },
      estimatedLevel: 'B1', selfAssessedLevel: 'B1-B2',
    })).toEqual([]);
  });
});
