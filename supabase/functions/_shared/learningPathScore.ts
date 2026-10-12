/**
 * Learning Path Score (LPS) v2: the learner's INTENSITY (decision D3), computed
 * deterministically from the Welcome Test traits. Pure (no Deno APIs).
 *
 * Changes from v1 (kept on old profiles as raw_answers.learning_path without a
 * version):
 * - A missing signal is null and the weights are renormalised over the signals
 *   present (v1 used 50, indistinguishable from a real "medium"); `coverage` is
 *   the share of the total weight that was actually measured.
 * - Triangulation declared in src/data/welcomeTestQuestions.ts: the scenario
 *   items weigh twice the direct ones inside a component (q3c with q3 for
 *   motivation, q5c with q5 for study capacity).
 * - Capacity cap (decision D4): a learner who declares no study time or avoids
 *   homework is capped at "guided"; an urgent deadline still raises the path,
 *   but only up to "accelerated", and the teacher gets `unrealistic_goal`.
 */

export const LPS_VERSION = 2;

export type LearningPathName = 'comfort' | 'guided' | 'accelerated' | 'target';
export type Capacity = 'low' | 'normal' | 'high';

export interface LearningPathV2 {
  version: 2;
  score: number | null;
  path: LearningPathName | null;
  component_scores: Record<string, number | null>;
  coverage: number;
  overrides_applied: string[];
  capacity: Capacity | null;
  capacity_cap: number | null;
  capacity_warning: 'unrealistic_goal' | null;
}

export const LOW_CAPACITY_CAP = 50; // top of "guided"
export const LOW_CAPACITY_URGENT_CAP = 75; // top of "accelerated"

export function pathForScore(score: number): LearningPathName {
  if (score >= 76) return 'target';
  if (score >= 51) return 'accelerated';
  if (score >= 26) return 'guided';
  return 'comfort';
}

const pick = (map: Record<string, number>, value: string | undefined): number | null =>
  value !== undefined && value in map ? map[value] : null;

/** Direct answer and scenario answer of one construct: the scenario weighs twice. */
const triangulate = (direct: number | null, scenario: number | null): number | null => {
  if (direct === null) return scenario;
  if (scenario === null) return direct;
  return Math.round((direct + 2 * scenario) / 3);
};

export const Q3B_OPTIONS = [
  'At work - emails, meetings, calls',
  'Traveling - airports, hotels, restaurants',
  'Online - social media, forums, gaming',
  'With friends/family who speak English',
  'Consuming content - movies, books, podcasts',
  'In my professional field (medical, legal, IT, etc.)',
];
const Q3B_SCORES: Record<number, number> = { 0: 70, 1: 40, 2: 30, 3: 35, 4: 25, 5: 80 };
export const Q9_OPTIONS = ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', 'More than 10 years'];
const Q9_SCORES: Record<number, number> = { 0: 70, 1: 60, 2: 45, 3: 30, 4: 15 };
export const Q10_OPTIONS = [
  'School (as a subject)', 'University', 'Private lessons with a teacher', 'Language school/course',
  'Self-study (apps, books, YouTube)', 'Living/working in an English-speaking country', 'Through work (using English daily)',
];

/** Weights as in v1; they sum to 1. */
const WEIGHTS: Record<string, number> = {
  deadline_response: 0.10,
  learning_timeline: 0.15,
  persistence_level: 0.10,
  career_importance: 0.10,
  usage_context: 0.05,
  motivation_type: 0.06,
  ambiguity_tolerance: 0.06,
  weekly_study_time: 0.07,
  anxiety_level: 0.06,
  learning_duration: 0.04,
  learning_autonomy: 0.04,
  error_attitude: 0.05,
  reading_strategy: 0.04,
  feedback_preference: 0.04,
  confidence_overall: 0.04,
};

export function studyCapacity(traits: Record<string, string>): Capacity | null {
  const time = traits.weekly_study_time;
  const hw = traits.homework_commitment;
  if (time === undefined && hw === undefined) return null;
  if (time === 'none' || hw === 'avoidant' || hw === 'low') return 'low';
  if ((time === '2_3_hours' || time === '3_plus_hours') && (hw === undefined || hw === 'high' || hw === 'proactive')) {
    return 'high';
  }
  return 'normal';
}

export function computeLearningPathScore(
  traits: Record<string, string>,
  answers: Record<string, unknown> | null | undefined,
): LearningPathV2 {
  const overrides: string[] = [];
  const c: Record<string, number | null> = {};

  c.deadline_response = pick({ intense_preparation: 80, pragmatic_coping: 60, avoidance: 20, confident: 50 }, traits.deadline_response);
  c.learning_timeline = pick({ urgent_specific: 95, ongoing_important: 60, long_term_steady: 25, hobby_growth: 10 }, traits.learning_timeline);
  c.persistence_level = pick({ high: 80, medium: 50, low: 20 }, traits.persistence_level);
  c.career_importance = pick({ critical: 90, high: 70, moderate: 40, not_career: 15 }, traits.career_english_importance);

  // Q3b usage context (multi-select): the highest-stakes context.
  const contextMap: Record<string, number> = { work_formal: 70, professional_field: 80, travel: 40, social: 35, online_informal: 30, content_consumption: 25 };
  let context: number | null = null;
  const q3b = answers?.wt_q3b;
  if (Array.isArray(q3b)) {
    const scores = q3b.map((a) => Q3B_OPTIONS.indexOf(String(a))).filter((i) => i >= 0).map((i) => Q3B_SCORES[i]);
    if (scores.length > 0) context = Math.max(...scores);
  } else if (traits.usage_context) {
    const scores = traits.usage_context.split(',').map((v) => contextMap[v.trim()]).filter((v) => typeof v === 'number');
    if (scores.length > 0) context = Math.max(...scores);
  }
  c.usage_context = context;

  c.motivation_type = triangulate(
    pick({ instrumental: 70, integrative: 30, mixed: 50 }, traits.motivation_type),
    pick({ career_critical: 75, lifestyle: 30, travel_lifestyle: 35 }, traits.latent_goal),
  );
  c.ambiguity_tolerance = pick({ high: 75, medium: 45, low: 15 }, traits.ambiguity_tolerance);
  c.weekly_study_time = triangulate(
    pick({ none: 10, '15_30_min': 25, '1_hour': 45, '2_3_hours': 70, '3_plus_hours': 90 }, traits.weekly_study_time),
    pick({ proactive: 85, high: 75, pragmatic: 50, low: 20, avoidant: 10 }, traits.homework_commitment),
  );
  c.anxiety_level = pick({ low: 70, medium: 40, high: 10 }, traits.anxiety_level);

  let durationIndex = -1;
  const q9 = answers?.wt_q9;
  if (typeof q9 === 'string') durationIndex = Q9_OPTIONS.indexOf(q9);
  c.learning_duration = durationIndex >= 0 ? Q9_SCORES[durationIndex] : null;

  let autonomy: number | null = null;
  const q10 = answers?.wt_q10;
  if (Array.isArray(q10) && q10.length > 0) {
    const idx = q10.map((a) => Q10_OPTIONS.indexOf(String(a)));
    if (idx.includes(5)) autonomy = 80;
    else if (idx.includes(4) || idx.includes(6)) autonomy = 70;
    else if (idx.length === 1 && idx[0] === 0) autonomy = 20;
    else autonomy = 40;
  }
  c.learning_autonomy = autonomy;

  c.error_attitude = pick({ comfortable: 75, cautious: 40, avoidant: 10 }, traits.error_attitude);
  c.reading_strategy = pick({ careful_lookup: 50, clarification_seeker: 55, context_guesser: 75, struggles_translates: 25, avoids_uses_ai: 35 }, traits.reading_strategy);
  c.feedback_preference = pick({ immediate: 65, delayed_discussion: 45, major_only: 35, written_review: 50, self_correct: 70 }, traits.feedback_preference);

  let confidence: number | null = null;
  const q44 = answers?.wt_q44;
  if (q44 && typeof q44 === 'object' && !Array.isArray(q44)) {
    const values = Object.values(q44 as Record<string, unknown>).filter((v): v is number => typeof v === 'number');
    if (values.length > 0) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      confidence = Math.max(0, Math.min(100, (avg - 1) * 25));
    }
  }
  c.confidence_overall = confidence;

  let weightSum = 0;
  let weighted = 0;
  for (const [name, w] of Object.entries(WEIGHTS)) {
    const v = c[name];
    if (v === null || v === undefined) continue;
    weightSum += w;
    weighted += w * v;
  }
  const coverage = Math.round(weightSum * 100) / 100;
  const capacity = studyCapacity(traits);

  if (weightSum === 0) {
    return {
      version: 2, score: null, path: null, component_scores: c, coverage: 0,
      overrides_applied: [], capacity, capacity_cap: null, capacity_warning: null,
    };
  }

  let score = weighted / weightSum;

  // Override rules (as v1).
  if (traits.learning_timeline === 'urgent_specific' && traits.career_english_importance === 'critical' && score < 85) {
    score = 85; overrides.push('urgent_critical_override');
  }
  if (traits.persistence_level === 'low' && traits.learning_timeline === 'hobby_growth' && score > 25) {
    score = 25; overrides.push('lazy_hobby_override');
  }
  if (traits.learning_timeline === 'urgent_specific' && traits.persistence_level === 'low' && score < 70) {
    score = 70; overrides.push('urgent_lazy_override');
  }
  if (traits.anxiety_level === 'high' && traits.weekly_study_time === 'none' && score > 20) {
    score = 20; overrides.push('anxious_notime_override');
  }
  if (durationIndex === 4 && traits.persistence_level === 'low' && score > 30) {
    score = 30; overrides.push('fossilization_override');
  }

  // Plateau response (as v1).
  if (traits.plateau_response === 'doubt_prone') {
    score -= 8; overrides.push('plateau_doubt_prone');
  } else if (traits.plateau_response === 'intensity_response' && traits.persistence_level === 'high') {
    score += 8; overrides.push('plateau_intensity_high_grit');
  } else if (traits.plateau_response === 'adaptive') {
    score += 4; overrides.push('plateau_adaptive');
  } else if (traits.plateau_response === 'resilient' && traits.deadline_response === 'intense_preparation') {
    score += 6; overrides.push('plateau_resilient_intense');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Capacity cap (D4): applied last, so no override can push past declared capacity.
  let capacityCap: number | null = null;
  let capacityWarning: 'unrealistic_goal' | null = null;
  if (capacity === 'low') {
    const urgent = traits.learning_timeline === 'urgent_specific';
    capacityCap = urgent ? LOW_CAPACITY_URGENT_CAP : LOW_CAPACITY_CAP;
    if (score > capacityCap) {
      score = capacityCap;
      overrides.push('low_capacity_cap');
    }
    if (urgent) capacityWarning = 'unrealistic_goal';
  }

  return {
    version: 2,
    score,
    path: pathForScore(score),
    component_scores: c,
    coverage,
    overrides_applied: overrides,
    capacity,
    capacity_cap: capacityCap,
    capacity_warning: capacityWarning,
  };
}
