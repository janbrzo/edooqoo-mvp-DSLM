import rawCases from './whatToTeachNextCases.json';

export type NextLessonDecision = 'Continue' | 'Repair' | 'Advance';

export interface WhatToTeachNextCase {
  slug: string;
  title: string;
  summary: string;
  studentContext: string;
  evidence: string[];
  decision: NextLessonDecision;
  decisionReason: string;
  lessonObjective: string;
  activitySequence: string[];
  evidenceToCollect: string[];
}

export const WHAT_TO_TEACH_NEXT_CASES = rawCases as WhatToTeachNextCase[];

export function getWhatToTeachNextCase(slug?: string) {
  return WHAT_TO_TEACH_NEXT_CASES.find((item) => item.slug === slug);
}
