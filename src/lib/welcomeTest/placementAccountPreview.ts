import type { PublicPlacementResult } from '@/lib/welcomeTest/publicPlacementTest';

const SKILL_LABEL: Record<string, string> = {
  grammar: 'grammar accuracy', vocabulary: 'vocabulary range',
  reading: 'reading comprehension', listening: 'listening comprehension',
};

const FIRST_LESSON_FOCUS: Record<string, string> = {
  grammar: 'a short grammar-in-context worksheet built on everyday work situations',
  vocabulary: 'a topic vocabulary worksheet with collocations the student can use right away',
  reading: 'a short authentic reading with comprehension and discussion tasks',
  listening: 'a listening-based worksheet with a short dialogue and follow-up speaking',
};

export interface PlacementAccountPreview {
  goals: string[];
  firstLesson: string | null;
  level: string | null;
}

/**
 * What the teacher account creates from THIS student's report on claim.
 * Mirrors the claim seed (weakest skill goal, then strongest skill goal) so the preview never promises more.
 */
export function buildPlacementAccountPreview(result: PublicPlacementResult): PlacementAccountPreview {
  const scored = Object.entries(result.skills)
    .filter(([, s]) => typeof s?.score === 'number')
    .sort((a, b) => (b[1]!.score as number) - (a[1]!.score as number));
  const strongest = scored[0]?.[0] ?? null;
  const weakest = scored.length > 1 ? scored[scored.length - 1][0] : null;
  const goals: string[] = [];
  if (weakest) goals.push(`Improve ${SKILL_LABEL[weakest] ?? weakest}`);
  if (strongest && strongest !== weakest) goals.push(`Build confidence from ${SKILL_LABEL[strongest] ?? strongest}`);
  const focus = weakest ?? strongest;
  return { goals, firstLesson: focus ? FIRST_LESSON_FOCUS[focus] ?? null : null, level: result.level };
}
