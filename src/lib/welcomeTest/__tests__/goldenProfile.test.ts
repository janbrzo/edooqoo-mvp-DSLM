/**
 * Golden profile regression: fixed answer sets -> exact traits, Learning Path Score,
 * divergences and level. The psychological inputs (traits, LPS, divergences) must not
 * change for stored data: the expected values below were produced by the code BEFORE
 * estimateLevel existed and are pinned literally.
 */
import { describe, it, expect } from 'vitest';
import live from './liveStudentAnswers.json';
import { reconstructTraits } from '../../../../supabase/functions/_shared/welcomeTestTraits';
import { computeLearningPathScore } from '../../../../supabase/functions/_shared/learningPathScore';
import { computeDivergences } from '../../../../supabase/functions/_shared/welcomeTestSignals';
import { estimateLevel } from '../../../../supabase/functions/_shared/welcomeTestLevel';

const EM = '—';

/** The E2E test student of the live audit (WS6-b): A2 measured, self-assessed B2-C1, 5/5 confidence. */
const LIVE = live as Record<string, unknown>;

/** Profile saved before commit bf57f19: em dash option text, multi-select q3b with two options. */
const LEGACY: Record<string, unknown> = {
  wt_q1: 'I can talk about most topics, but I make grammar mistakes and miss some words',
  wt_q3: `I need it for work ${EM} meetings, emails, presentations`,
  wt_q3b: ['Traveling - airports, hotels, restaurants', 'With friends/family who speak English'],
  wt_q3c: 'I watch Netflix shows without subtitles, effortlessly',
  wt_q4: 'I try to guess from context',
  wt_q5: "2-3 hours - I'm committed",
  wt_q5b: "I'd feel nervous but would ask a colleague for help and practice the key phrases",
  wt_q5c: `I already did it earlier ${EM} I don't leave things until the last minute`,
  wt_q7: `I do not mind ${EM} that is how you learn`,
  wt_q7b: `Correct me immediately ${EM} I want to know right away`,
  wt_q8: 'Hearing it in a sentence',
  wt_q9: '3-5 years',
  wt_q10: ['Private lessons with a teacher'],
  wt_q13b: 'I stuck with it and got pretty good at it',
  wt_q13c: `Push harder ${EM} more hours, more material`,
  wt_q14: 'I say "Sorry, could you repeat that please?" and try again',
  wt_q15: 'I read it carefully, look up unknown words, and reply',
  wt_q17b: "I'd apply and highlight my other strengths to compensate for my English",
  wt_q41b: `I'm learning English for the long term ${EM} there's no rush, but I want steady progress`,
  wt_q42: 'Note them down and discuss at the end',
  wt_q44: { 'Giving presentations': 3, 'Reading news articles': 4, 'Small talk at parties': 4, 'Writing formal emails': 3, 'Speaking with strangers': 2, 'Understanding movies without subtitles': 3 },
};

/** Sparse: two answers only. */
const SPARSE: Record<string, unknown> = { wt_q1: LIVE.wt_q1, wt_q42: LIVE.wt_q42 };

const LIVE_TRAITS = {
  self_assessed_level: 'B2-C1', motivation_type: 'instrumental', ambiguity_tolerance: 'low', weekly_study_time: '3_plus_hours',
  anxiety_level: 'high', preferred_input_channel: 'kinesthetic', error_attitude: 'avoidant', feedback_preference: 'immediate',
  deadline_response: 'intense_preparation', persistence_level: 'low', career_english_importance: 'critical',
  reading_strategy: 'avoids_uses_ai', learning_timeline: 'urgent_specific', latent_goal: 'career_critical',
  homework_commitment: 'low', plateau_response: 'doubt_prone', correction_preference: 'selective',
};

const LEGACY_TRAITS = {
  self_assessed_level: 'B1-B2', motivation_type: 'instrumental', ambiguity_tolerance: 'high', weekly_study_time: '2_3_hours',
  anxiety_level: 'low', preferred_input_channel: 'auditory', error_attitude: 'comfortable', feedback_preference: 'delayed_discussion',
  deadline_response: 'pragmatic_coping', persistence_level: 'high', career_english_importance: 'moderate',
  reading_strategy: 'careful_lookup', learning_timeline: 'long_term_steady', latent_goal: 'lifestyle',
  homework_commitment: 'proactive', plateau_response: 'intensity_response', correction_preference: 'immediate',
};

const withoutUsageContext = (t: Record<string, string>) => {
  const { usage_context: _u, ...rest } = t;
  return rest;
};

describe('golden profile: live test student', () => {
  const traits = reconstructTraits(LIVE);
  it('traits are exact (usage_context is the only addition)', () => {
    expect(withoutUsageContext(traits)).toEqual(LIVE_TRAITS);
    expect(traits.usage_context).toBe('work_formal');
  });
  it('Learning Path Score v2 is exact and equals the stored production value (75, accelerated, low capacity cap)', () => {
    const lps = computeLearningPathScore(traits, LIVE);
    expect(lps).toEqual({
      version: 2, score: 75, path: 'accelerated',
      component_scores: {
        deadline_response: 80, learning_timeline: 95, persistence_level: 20, career_importance: 90, usage_context: 70,
        motivation_type: 73, ambiguity_tolerance: 15, weekly_study_time: 43, anxiety_level: 10, learning_duration: 60,
        learning_autonomy: 70, error_attitude: 10, reading_strategy: 35, feedback_preference: 65, confidence_overall: 100,
      },
      coverage: 1,
      overrides_applied: ['urgent_critical_override', 'plateau_doubt_prone', 'low_capacity_cap'],
      capacity: 'low', capacity_cap: 75, capacity_warning: 'unrealistic_goal',
    });
  });
  it('LPS is identical with and without the usage_context trait', () => {
    expect(computeLearningPathScore(traits, LIVE)).toEqual(computeLearningPathScore(withoutUsageContext(traits), LIVE));
  });
  it('level from the FINAL scores (writing 48 after AI scoring) is A2, overestimated', () => {
    expect(estimateLevel({ grammar: 38, vocabulary: 75, reading: 50, writing: 48, selfAssessedLevel: traits.self_assessed_level }))
      .toEqual({ level: 'A2', confidence: 'overestimates', averageScore: 52.75, scoredSkills: ['grammar', 'vocabulary', 'reading', 'writing'], version: 2 });
  });
  it('divergences are exact', () => {
    const level = estimateLevel({ grammar: 38, vocabulary: 75, reading: 50, writing: 48, selfAssessedLevel: traits.self_assessed_level });
    const divergences = computeDivergences({
      traits, estimatedLevel: level.level, selfAssessedLevel: traits.self_assessed_level,
      confidenceMatrix: LIVE.wt_q44 as Record<string, unknown>, readingScore: 50, writingScore: 48, speakingScore: null,
      selfAwarenessScore: 33, skillWrongOrIdk: 12,
      behaviour: { keyed_total: 40, keyed_answered: 36, skip_count_skill: 4, idk_count_skill: 3, coverage: 0.9, median_seconds_keyed: 6, rushed_count: 2 },
    });
    expect(divergences).toEqual([
      { pair: 'level', declared: 'self-assessed B2-C1', observed: 'measured A2', gap: 2.5, severity: 'strong' },
      { pair: 'capacity', declared: 'study time: 3 plus hours', observed: 'homework under low motivation: low', gap: null, severity: 'notable' },
      { pair: 'confidence_reading', declared: 'confidence 5/5', observed: 'score 50%', gap: 50, severity: 'notable' },
      { pair: 'confidence_writing', declared: 'confidence 5/5', observed: 'score 48%', gap: 52, severity: 'strong' },
    ]);
  });
});

describe('golden profile: legacy option text (em dash) and multi-select q3b', () => {
  const traits = reconstructTraits(LEGACY);
  it('legacy text resolves to the same traits as the current text', () => {
    expect(withoutUsageContext(traits)).toEqual(LEGACY_TRAITS);
  });
  it('q3b selections are joined with ", " in answer order', () => {
    expect(traits.usage_context).toBe('travel, social');
  });
  it('Learning Path Score is exact', () => {
    expect(computeLearningPathScore(traits, LEGACY)).toEqual({
      version: 2, score: 62, path: 'accelerated',
      component_scores: {
        deadline_response: 60, learning_timeline: 25, persistence_level: 80, career_importance: 40, usage_context: 40,
        motivation_type: 43, ambiguity_tolerance: 75, weekly_study_time: 80, anxiety_level: 70, learning_duration: 45,
        learning_autonomy: 40, error_attitude: 75, reading_strategy: 50, feedback_preference: 45, confidence_overall: 54.166666666666664,
      },
      coverage: 1, overrides_applied: ['plateau_intensity_high_grit'], capacity: 'high', capacity_cap: null, capacity_warning: null,
    });
    expect(computeLearningPathScore(traits, LEGACY)).toEqual(computeLearningPathScore(withoutUsageContext(traits), LEGACY));
  });
  it('level without a scored writing item uses the three scored skills', () => {
    expect(estimateLevel({ grammar: 80, vocabulary: 70, reading: 60, writing: null, selfAssessedLevel: traits.self_assessed_level }))
      .toEqual({ level: 'B1', confidence: 'accurate', averageScore: 70, scoredSkills: ['grammar', 'vocabulary', 'reading'], version: 2 });
  });
  it('divergences are exact', () => {
    expect(computeDivergences({
      traits, estimatedLevel: 'B1', selfAssessedLevel: traits.self_assessed_level,
      confidenceMatrix: LEGACY.wt_q44 as Record<string, unknown>, readingScore: 60, writingScore: null, speakingScore: null,
      selfAwarenessScore: null, skillWrongOrIdk: 0, behaviour: null,
    })).toEqual([
      { pair: 'motivation', declared: 'instrumental motivation', observed: 'latent goal: lifestyle', gap: null, severity: 'notable' },
    ]);
  });
});

describe('golden profile: sparse answers', () => {
  it('only the answered traits exist and the LPS is built from one component', () => {
    const traits = reconstructTraits(SPARSE);
    expect(traits).toEqual({ self_assessed_level: 'B2-C1', feedback_preference: 'immediate' });
    const lps = computeLearningPathScore(traits, SPARSE);
    expect(lps.score).toBe(65);
    expect(lps.coverage).toBe(0.04);
    expect(lps.overrides_applied).toEqual([]);
  });
});
