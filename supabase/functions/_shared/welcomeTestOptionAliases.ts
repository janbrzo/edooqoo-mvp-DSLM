/**
 * Welcome Test stored answers are option TEXT. Commit bf57f19 ("Remove em dashes")
 * rewrote some option texts, but profiles saved before that still hold the old text.
 * Every place that maps a stored answer back to an option index must go through
 * `matchOptionIndex` so legacy text keeps resolving to the same option.
 *
 * Rule: option text is stored data. Never edit an option string in
 * src/data/welcomeTestQuestions.ts without adding the previous text here.
 * Pure (no Deno APIs). U+2014 is written as an escape (no-em-dash rule).
 */

/**
 * Question id -> legacy option text -> current option text.
 * The wt_q1, wt_q3 and wt_q7 entries without an em dash were added in iteration 11: older wordings
 * that stored profiles still hold (the D15 dry run found 17 of 36 profiles with answers matching no option).
 */
export const LEGACY_OPTION_TEXT: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  wt_q1: {
    'I can handle basic everyday situations like ordering food or asking for directions': 'I can do basic things, like ordering food or asking for directions',
    'I can have simple conversations about familiar topics but struggle with complex ideas': 'I can have simple talks about everyday topics, but harder ideas are tough',
    'I can discuss most topics but make grammatical mistakes and sometimes lack vocabulary': 'I can talk about most topics, but I make grammar mistakes and miss some words',
    'I speak fluently in most situations but want to sound more natural and precise': 'I speak fluently most of the time, but I want to sound more natural',
  },
  wt_q3: {
    'I need it for my job - meetings, emails, presentations': 'I need it for work: meetings, emails, presentations',
    'I\'m preparing for an exam (IELTS, Cambridge, etc.)': 'I am preparing for an exam (IELTS, Cambridge, etc.)',
    'I want to travel and communicate freely': 'I want to travel and talk freely',
    'I want to watch movies/read books without subtitles': 'I want to watch films and read books without subtitles',
    'I want to feel confident talking to English speakers': 'I want to feel confident with English speakers',
    'Career advancement - I need English for promotion': 'I want a promotion that needs English',
    'I need it for work \u2014 meetings, emails, presentations': 'I need it for work: meetings, emails, presentations',
  },
  wt_q5c: {
    'I already did it earlier \u2014 I don\'t leave things until the last minute': 'I already did it earlier; I don\'t leave things until the last minute',
  },
  wt_q7: {
    'I don\'t mind at all - that\'s how you learn': 'I do not mind; that is how you learn',
    'I feel embarrassed but try to push through': 'I feel shy, but I keep going',
    'I avoid speaking because I\'m afraid of mistakes': 'I avoid speaking because I fear mistakes',
    'I do not mind \u2014 that is how you learn': 'I do not mind; that is how you learn',
  },
  wt_q7b: {
    'Correct me immediately \u2014 I want to know right away': 'Correct me immediately: I want to know right away',
    'Only correct serious mistakes \u2014 small ones discourage me': 'Only correct serious mistakes, small ones discourage me',
  },
  wt_q13c: {
    'Push harder \u2014 more hours, more material': 'Push harder: more hours, more material',
  },
};

/**
 * Conservative fallback: trim, collapse whitespace, unify curly apostrophes and
 * make every dash variant (em dash, spaced hyphen) the same token.
 */
export function normalizeOptionText(s: string): string {
  return s
    .replace(/[‘’]/g, '\'')
    .replace(/\s*\u2014\s*/g, ' - ')
    .replace(/\s+-\s+/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Index of `answer` in `options` (current texts of `questionId`), or -1.
 * Order: exact match, legacy alias, normalised match (answer vs options and aliases).
 */
export function matchOptionIndex(questionId: string, options: readonly string[], answer: string): number {
  const exact = options.indexOf(answer);
  if (exact >= 0) return exact;
  const aliases = LEGACY_OPTION_TEXT[questionId];
  const aliased = aliases && Object.prototype.hasOwnProperty.call(aliases, answer) ? aliases[answer] : undefined;
  if (aliased !== undefined) {
    const i = options.indexOf(aliased);
    if (i >= 0) return i;
  }
  const n = normalizeOptionText(answer);
  const byNorm = options.findIndex((o) => normalizeOptionText(o) === n);
  if (byNorm >= 0) return byNorm;
  if (aliases) {
    for (const [legacy, current] of Object.entries(aliases)) {
      if (normalizeOptionText(legacy) === n) {
        const i = options.indexOf(current);
        if (i >= 0) return i;
      }
    }
  }
  return -1;
}
