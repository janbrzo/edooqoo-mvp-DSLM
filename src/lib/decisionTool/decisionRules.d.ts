export type Decision = 'Repair' | 'Continue' | 'Advance';
export type DecisionInput = {
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  goal: 'workplace-speaking' | 'business-writing' | 'travel-communication' | 'job-interview' | 'exam-performance' | 'general-communication';
  mastery: 'insufficient' | 'not-mastered' | 'partial' | 'secure';
  independence: 'no-evidence' | 'supported' | 'independent';
  recurringError: 'blocking' | 'non-blocking' | 'none';
  homework: 'not-assigned' | 'incomplete' | 'mixed' | 'successful';
  upcoming: 'none' | 'work-meeting' | 'business-writing' | 'interview' | 'travel' | 'exam';
};

export type DecisionResult = {
  decision: Decision;
  rationale: string;
  lessonObjective: string;
  activitySequence: string[];
  worksheetBrief: string;
  evidenceToCollect: string[];
};

export const DECISIONS: Decision[];
export const CEFR_LEVELS: DecisionInput['level'][];
export const GOALS: Record<DecisionInput['goal'], string>;
export const MASTERY: Record<DecisionInput['mastery'], string>;
export const INDEPENDENCE: Record<DecisionInput['independence'], string>;
export const RECURRING_ERRORS: Record<DecisionInput['recurringError'], string>;
export const HOMEWORK_RESULTS: Record<DecisionInput['homework'], string>;
export const UPCOMING_SITUATIONS: Record<DecisionInput['upcoming'], string>;
export const DEFAULT_DECISION_INPUT: DecisionInput;

export function decideNextLesson(input: DecisionInput): DecisionResult;
export function serializeDecisionInput(input: DecisionInput): string;
export function parseDecisionInput(search: string): DecisionInput;
