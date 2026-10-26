import { CEFR_LEVELS, type DecisionInput } from '@/lib/decisionTool/decisionRules.mjs';

export const PUBLIC_GALLERY_EXAMPLES = [
  {
    slug: 'travel-memories-present-perfect-vs-past-simple-304045',
    title: 'Travel Memories: Present Perfect vs. Past Simple',
    focus: 'Compare past trips with life experience in a published grammar worksheet.',
  },
  {
    slug: 'making-future-plans-with-old-university-friends-2cc98e',
    title: 'Making Future Plans with Old University Friends',
    focus: 'Explore plans, arrangements and discussion in an adult social context.',
  },
] as const;

export interface PublishedExample {
  slug: string;
  title: string;
  focus: string;
  level: DecisionInput['level'] | null;
}

/** Do not infer learner mastery, goals, or a single level from mixed worksheet bands. */
export function publicDecisionPath(level?: string | null): string {
  const validLevel = CEFR_LEVELS.find((candidate) => candidate === level);
  return validLevel
    ? `/tools/what-should-i-teach-next?level=${validLevel}`
    : '/tools/what-should-i-teach-next';
}

/** Only the publication-filtered metadata list is allowed, never worksheet detail payloads. */
export function selectPublishedExamples(rows: unknown): PublishedExample[] {
  if (!Array.isArray(rows)) return [];
  return PUBLIC_GALLERY_EXAMPLES.flatMap((example) => {
    const row = rows.find((candidate) => candidate && typeof candidate === 'object'
      && candidate.public_slug === example.slug && typeof candidate.published_at === 'string');
    if (!row) return [];
    const level = CEFR_LEVELS.find((candidate) => candidate === row.public_level) ?? null;
    return [{ ...example, level }];
  });
}