/**
 * Welcome Test bank 2: which questions a student is shown, and the CEFR level of
 * every keyed item. Pure and shared: the browser decides what to show with it and
 * process-welcome-test decides what was shown, from the same answers.
 *
 * Bank 2 = the 58 questions of bank 1 plus 14 keyed questions (wt_q59..wt_q72):
 *  - always shown: wt_q65 (vocabulary A2), and the Reading & Listening section
 *    (wt_q68 reading A2, wt_q69 reading B1, wt_q71 listening A2, wt_q72 listening B2);
 *  - adaptive blocks, appended to the end of their section once the answers they
 *    depend on exist: grammar A1 / C1, vocabulary A1 / C1, reading C1.
 * A typical A2-B2 student therefore sees 5 extra questions, a beginner 9, an
 * advanced student 10 (never all 14).
 */
export type WelcomeTestCefr = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

/** What a verdict says about one question: true/false = scored, null = answered but unscored, undefined = not answered. */
export type VerdictOf = (id: string) => boolean | null | undefined;

/** Question ids of bank 2 that are not in bank 1, in array (question_index) order. */
export const BANK2_NEW_IDS = [
  'wt_q59', 'wt_q60', 'wt_q61', 'wt_q62', 'wt_q63', 'wt_q64', 'wt_q65',
  'wt_q66', 'wt_q67', 'wt_q68', 'wt_q69', 'wt_q70', 'wt_q71', 'wt_q72',
] as const;

/** Questions of the new Reading & Listening section that every student gets, in order. */
export const RECEPTIVE_ALWAYS_IDS = ['wt_q68', 'wt_q69'] as const;
export const RECEPTIVE_LISTENING_IDS = ['wt_q71', 'wt_q72'] as const;
export const RECEPTIVE_C1_READING_ID = 'wt_q70';

export interface BranchBlock {
  id: string;
  /** Section the block is appended to. */
  section: 'grammar' | 'vocabulary' | 'receptive';
  /** Questions of the block, in display order. */
  ids: readonly string[];
  /** Answers the decision is based on: the block is decided once all of them exist. */
  basis: readonly string[];
  /** True when the block should be shown, given the verdicts of the basis questions. */
  show: (verdict: VerdictOf) => boolean;
}

const GRAMMAR_ALL = ['wt_q20', 'wt_q21', 'wt_q22', 'wt_q23', 'wt_q24', 'wt_q25', 'wt_q26', 'wt_q27'];
const GRAMMAR_A2 = ['wt_q20', 'wt_q24'];
const GRAMMAR_HARD = ['wt_q21', 'wt_q22', 'wt_q23', 'wt_q26', 'wt_q27']; // B1-B2 and above
const VOCAB_B1 = ['wt_q28', 'wt_q29', 'wt_q30', 'wt_q31', 'wt_q32'];
const VOCAB_B2 = ['wt_q33', 'wt_q34', 'wt_q35'];

const correctCount = (verdict: VerdictOf, ids: readonly string[]) =>
  ids.filter((id) => verdict(id) === true).length;

/**
 * The rules (owner-approved structure, 2026-10-23). A question that is skipped has no
 * answer, so a block depending on it stays undecided until the student answers it;
 * "I don't know" is an answer and counts as not correct.
 */
export const BRANCH_BLOCKS: readonly BranchBlock[] = [
  {
    id: 'grammar_c1', section: 'grammar', ids: ['wt_q61', 'wt_q62'],
    basis: GRAMMAR_HARD,
    show: (v) => correctCount(v, GRAMMAR_HARD) >= 4,
  },
  {
    id: 'grammar_a1', section: 'grammar', ids: ['wt_q59', 'wt_q60'],
    basis: GRAMMAR_ALL,
    // Both A2 items wrong, or at most 3 of the 8 grammar items right.
    show: (v) => correctCount(v, GRAMMAR_A2) === 0 || correctCount(v, GRAMMAR_ALL) <= 3,
  },
  {
    id: 'vocabulary_a1', section: 'vocabulary', ids: ['wt_q63', 'wt_q64'],
    basis: [...VOCAB_B1, 'wt_q65'],
    // The A2 item is wrong, or at most 2 of the 5 B1 vocabulary items are right.
    show: (v) => v('wt_q65') !== true || correctCount(v, VOCAB_B1) <= 2,
  },
  {
    id: 'vocabulary_c1', section: 'vocabulary', ids: ['wt_q66', 'wt_q67'],
    basis: VOCAB_B2,
    show: (v) => correctCount(v, VOCAB_B2) >= 2,
  },
  {
    id: 'reading_c1', section: 'receptive', ids: [RECEPTIVE_C1_READING_ID],
    basis: ['wt_q18', 'wt_q19'],
    show: (v) => v('wt_q18') === true && v('wt_q19') === true,
  },
];

/**
 * Branch questions that are visible: the block is decided (all basis answers exist)
 * and its rule says show, or the student already answered the question (a question
 * never disappears from under an answer, even if an earlier answer is changed).
 */
export function visibleBranchIds(verdict: VerdictOf): Set<string> {
  const visible = new Set<string>();
  for (const block of BRANCH_BLOCKS) {
    const decided = block.basis.every((id) => verdict(id) !== undefined);
    const show = decided && block.show(verdict);
    for (const id of block.ids) {
      if (show || verdict(id) !== undefined) visible.add(id);
    }
  }
  return visible;
}

/**
 * Ids of the new questions a student was shown (always-shown ones plus the visible
 * branch questions). Everything in bank 1 is always shown and is not listed here.
 */
export function shownNewIds(verdict: VerdictOf): Set<string> {
  const shown = new Set<string>(['wt_q65', ...RECEPTIVE_ALWAYS_IDS, ...RECEPTIVE_LISTENING_IDS]);
  for (const id of visibleBranchIds(verdict)) shown.add(id);
  return shown;
}

/**
 * CEFR level of every keyed item that counts towards the level (bank 2 ladder).
 * Items marked B1-B2 in the bank are counted at B1 and B2-C1 at B2, the lower level,
 * so a level is never granted on an item of the level above it. wt_q39 (a scenario)
 * and the open writing and speaking items carry no level.
 */
export const LEVEL_ITEM_CEFR: Readonly<Record<string, WelcomeTestCefr>> = {
  // grammar
  wt_q59: 'A1', wt_q60: 'A1',
  wt_q20: 'A2', wt_q24: 'A2',
  wt_q21: 'B1', wt_q23: 'B1', wt_q25: 'B1', wt_q26: 'B1', wt_q38: 'B1',
  wt_q22: 'B2', wt_q27: 'B2',
  wt_q61: 'C1', wt_q62: 'C1',
  // vocabulary
  wt_q63: 'A1', wt_q64: 'A1',
  wt_q65: 'A2',
  wt_q28: 'B1', wt_q29: 'B1', wt_q30: 'B1', wt_q31: 'B1', wt_q32: 'B1',
  wt_q33: 'B2', wt_q34: 'B2', wt_q35: 'B2',
  wt_q66: 'C1', wt_q67: 'C1',
  // reading
  wt_q68: 'A2', wt_q18: 'B1', wt_q69: 'B1', wt_q19: 'B2', wt_q70: 'C1',
  // listening
  wt_q71: 'A2', wt_q18l: 'B1', wt_q72: 'B2',
};
