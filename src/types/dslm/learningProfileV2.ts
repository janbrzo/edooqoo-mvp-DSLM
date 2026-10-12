/**
 * Welcome Test learning profile v2 columns (iteration 5, migration 20261012180000).
 *
 * The generated Supabase types do not have these columns yet: read them through
 * `LearningProfileV2Columns` (all optional and nullable, old rows have none).
 */

export type LearningPathName = 'comfort' | 'guided' | 'accelerated' | 'target';

export type StudyCapacity = 'low' | 'normal' | 'high';

/** v2 shape (`learning_path` column). v1 rows (`raw_answers.learning_path`) have no `version`. */
export interface LearningPathResult {
  version?: number;
  score: number | null;
  path: LearningPathName | string | null;
  component_scores?: Record<string, number | null> | null;
  coverage?: number | null;
  overrides_applied?: string[] | null;
  capacity?: StudyCapacity | null;
  capacity_cap?: number | null;
  capacity_warning?: 'unrealistic_goal' | null;
}

export type DivergencePair =
  | 'level'
  | 'motivation'
  | 'capacity'
  | 'confidence_reading'
  | 'confidence_writing'
  | 'confidence_speaking'
  | 'anxiety'
  | 'metacognition';

export type DivergenceSeverity = 'info' | 'notable' | 'strong';

export interface ProfileDivergence {
  pair: DivergencePair | string;
  declared: string;
  observed: string;
  gap: number | null;
  severity: DivergenceSeverity;
}

export interface AnswerBehaviour {
  keyed_total: number;
  keyed_answered: number;
  skip_count_skill: number;
  idk_count_skill: number;
  coverage: number;
  median_seconds_keyed: number | null;
  rushed_count: number;
}

export interface LearningProfileV2Columns {
  traits?: Record<string, unknown> | null;
  learning_path?: LearningPathResult | null;
  divergences?: ProfileDivergence[] | null;
  answer_behaviour?: AnswerBehaviour | null;
  /** numeric column: PostgREST may return it as a string. */
  signal_coverage?: number | string | null;
  raw_answers?: unknown;
  ai_summary?: string | null;
}
