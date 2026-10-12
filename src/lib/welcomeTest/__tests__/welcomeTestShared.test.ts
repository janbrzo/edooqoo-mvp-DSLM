import { describe, it, expect } from 'vitest';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';
import {
  WELCOME_TEST_QUESTION_IDS,
  TRAIT_QUESTIONS,
  answersFromQuestionRows,
  reconstructTraits,
} from '../../../../supabase/functions/_shared/welcomeTestTraits';
import { computeLearningPathScore, pathForScore } from '../../../../supabase/functions/_shared/learningPathScore';
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
    expect(lp.version).toBe(2);
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

  it('audit case: no study time + urgent critical goal is capped at accelerated with a warning (D4)', () => {
    const lp = computeLearningPathScore({
      weekly_study_time: 'none', homework_commitment: 'pragmatic', anxiety_level: 'low',
      learning_timeline: 'urgent_specific', career_english_importance: 'critical',
      plateau_response: 'intensity_response', persistence_level: 'high',
    }, {});
    expect(lp.capacity).toBe('low');
    expect(lp.score).toBe(75);
    expect(lp.path).toBe('accelerated');
    expect(lp.capacity_warning).toBe('unrealistic_goal');
    expect(lp.overrides_applied).toContain('low_capacity_cap');
  });

  it('low capacity without urgency is capped at guided, without the urgency warning', () => {
    const lp = computeLearningPathScore({
      weekly_study_time: '2_3_hours', homework_commitment: 'avoidant',
      learning_timeline: 'ongoing_important', career_english_importance: 'critical', persistence_level: 'high',
      deadline_response: 'intense_preparation',
    }, {});
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
