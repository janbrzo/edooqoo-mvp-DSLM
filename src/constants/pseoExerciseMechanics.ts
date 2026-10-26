/**
 * Per-exercise-type mechanic descriptions for programmatic SEO exercise-topic pages.
 * Purpose: give every /worksheets/{exerciseType}/{topic} page a concrete, mechanic-specific
 * worked example, so two exercise types on the same topic are not near-duplicates.
 * Content follows the Martha Standard: adult 1:1 context, observable quality criteria.
 */

export interface PseoExerciseMechanic {
  slug: string;
  mechanic: string;
  workedExample: string;
  answerNote: string;
}

export const PSEO_EXERCISE_MECHANICS: Record<string, PseoExerciseMechanic> = {
  'error-correction': {
    slug: 'error-correction',
    mechanic:
      'The learner receives a sentence that contains one realistic flaw, diagnoses what is wrong, and produces a corrected version. The mechanic trains monitoring: noticing the gap between what was said and what the situation required.',
    workedExample:
      'Sample item: "I am working on this project since March." The learner identifies the open time frame and rewrites it as "I have been working on this project since March."',
    answerNote:
      'A strong error-correction item uses mistakes the specific learner actually makes, drawn from their homework or live-session output, not a generic list of common errors.',
  },
  'collocations-match': {
    slug: 'collocations-match',
    mechanic:
      'The learner pairs verbs, adjectives, or nouns with their natural partners, then uses each completed collocation in a sentence about their own work. The mechanic builds chunk-level fluency instead of single-word recall.',
    workedExample:
      'Sample item: match "chair", "postpone", and "wrap up" with "a meeting", "a decision", and "a call", then write one sentence about this week at work using each pair.',
    answerNote:
      'A strong collocations item uses pairs from the learner’s professional domain, so a project manager and a nurse practice different chunks at the same CEFR level.',
  },
  'gap-fill': {
    slug: 'gap-fill',
    mechanic:
      'The learner restores a missing element in an otherwise complete context: a word, a phrase, or a sentence part. The mechanic checks controlled recall inside meaningful text rather than isolated vocabulary.',
    workedExample:
      'Sample item: "The report was submitted ___ time, but the figures in section two need to be ___ before Friday." (on / revised)',
    answerNote:
      'A strong gap-fill keeps the surrounding context rich enough that the answer is constrained by meaning, not guessable from grammar alone.',
  },
};

export const getExerciseMechanic = (slug: string): PseoExerciseMechanic | undefined =>
  PSEO_EXERCISE_MECHANICS[slug];
