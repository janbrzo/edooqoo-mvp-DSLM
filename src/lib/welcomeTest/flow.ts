/**
 * What the student sees: the question definitions of a test (bank + form) and the
 * sections built from them. Bank 1 is the original 58-question test. Bank 2 adds
 * the adaptive blocks and the Reading & Listening section; the rules live in
 * supabase/functions/_shared/welcomeTestFlow.ts so the server decides "what was
 * shown" from the same answers.
 */
import {
  ALL_WELCOME_TEST_QUESTIONS,
  WELCOME_TEST_SECTIONS_WITH_QUESTIONS,
  WELCOME_TEST_SKILL_VARIANTS_B,
} from '@/data/welcomeTestQuestions';
import type { WelcomeTestQuestionDef, WelcomeTestSectionDef } from '@/types/welcomeTest';
import {
  BRANCH_BLOCKS,
  RECEPTIVE_ALWAYS_IDS,
  RECEPTIVE_C1_READING_ID,
  RECEPTIVE_LISTENING_IDS,
  visibleBranchIds,
  type VerdictOf,
} from '../../../supabase/functions/_shared/welcomeTestFlow';
import { WELCOME_TEST_BANK_SIZES, type WelcomeTestForm } from '../../../supabase/functions/_shared/welcomeTestBank';
import { checkWelcomeTestKeyedAnswer } from './keyedAnswer';

/** The question definitions of one bank in array (= question_index) order; Form B swaps in the variants. */
export function questionDefsFor(bank: number, form: WelcomeTestForm = 'A'): WelcomeTestQuestionDef[] {
  const size = WELCOME_TEST_BANK_SIZES[bank];
  if (!size) throw new Error(`Unknown Welcome Test bank ${bank}`);
  const defs = ALL_WELCOME_TEST_QUESTIONS.slice(0, size);
  return form === 'B' ? defs.map((q) => WELCOME_TEST_SKILL_VARIANTS_B[q.id] ?? q) : defs;
}

const RECEPTIVE_SECTION = {
  id: 'receptive' as const,
  title: 'Reading & Listening',
  subtitle: 'Short texts and audio. You can replay the audio.',
  icon: 'Headphones',
};

/**
 * Verdict of an answer for the branching rules: scored true/false for keyed items
 * ("I don't know" is false), null when the answer needs review, undefined when the
 * question has no answer yet.
 */
export function verdictFromAnswers(
  defs: readonly WelcomeTestQuestionDef[],
  answers: Record<string, unknown>,
): VerdictOf {
  const byId = new Map(defs.map((q) => [q.id, q]));
  return (id) => {
    const answer = answers[id];
    if (answer === undefined) return undefined;
    const def = byId.get(id);
    if (!def) return null;
    return checkWelcomeTestKeyedAnswer(def, answer);
  };
}

/**
 * The sections the student walks through. Bank 1 is static. In bank 2 the adaptive
 * blocks are appended to the end of their section once decided, and the Reading &
 * Listening section sits between vocabulary and communication.
 */
export function sectionsFor(
  bank: number,
  form: WelcomeTestForm,
  answers: Record<string, unknown>,
): WelcomeTestSectionDef[] {
  const defs = questionDefsFor(bank, form);
  if (bank === 1) {
    return form === 'B'
      ? WELCOME_TEST_SECTIONS_WITH_QUESTIONS.map((s) => ({
        ...s,
        questions: s.questions.map((q) => WELCOME_TEST_SKILL_VARIANTS_B[q.id] ?? q),
      }))
      : WELCOME_TEST_SECTIONS_WITH_QUESTIONS;
  }

  // Bank 2: definitions of the new questions come from the same Form A/B choice.
  const all = ALL_WELCOME_TEST_QUESTIONS;
  const pick = (id: string): WelcomeTestQuestionDef => {
    const a = all.find((q) => q.id === id)!;
    return form === 'B' ? (WELCOME_TEST_SKILL_VARIANTS_B[id] ?? a) : a;
  };
  const visible = visibleBranchIds(verdictFromAnswers(defs, answers));
  const blockIds = (section: 'grammar' | 'vocabulary' | 'receptive') =>
    BRANCH_BLOCKS.filter((b) => b.section === section).flatMap((b) => b.ids).filter((id) => visible.has(id));

  const out: WelcomeTestSectionDef[] = [];
  for (const base of WELCOME_TEST_SECTIONS_WITH_QUESTIONS) {
    const baseQs = base.questions.map((q) => pick(q.id));
    if (base.id === 'grammar') {
      out.push({ ...base, questions: [...baseQs, ...blockIds('grammar').map(pick)] });
    } else if (base.id === 'vocabulary') {
      out.push({ ...base, questions: [...baseQs, pick('wt_q65'), ...blockIds('vocabulary').map(pick)] });
      const receptive: string[] = [
        ...RECEPTIVE_ALWAYS_IDS,
        ...(visible.has(RECEPTIVE_C1_READING_ID) ? [RECEPTIVE_C1_READING_ID] : []),
        ...RECEPTIVE_LISTENING_IDS,
      ];
      out.push({ ...RECEPTIVE_SECTION, questions: receptive.map(pick) });
    } else {
      out.push({ ...base, questions: baseQs });
    }
  }
  return out;
}

/** Median seconds a student needs per question, by section (from 11 finished tests; used for the time left). */
export const SECTION_SECONDS_PER_QUESTION: Record<string, number> = {
  about_you: 20, experience: 20, scenarios: 45, grammar: 20, vocabulary: 15,
  receptive: 30, communication: 55, goals: 25,
};

/** Minutes left, from the unanswered questions of the visible sections (rounded up, at least 1). */
export function estimateMinutesLeft(
  sections: readonly WelcomeTestSectionDef[],
  answers: Record<string, unknown>,
): number {
  let seconds = 0;
  for (const s of sections) {
    const per = SECTION_SECONDS_PER_QUESTION[s.id] ?? 25;
    seconds += s.questions.filter((q) => answers[q.id] === undefined).length * per;
  }
  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * Progress 0..100 by section: completed sections count fully, the current one by the
 * share of its questions answered. Stays steady when adaptive questions appear.
 */
export function sectionProgress(
  sections: readonly WelcomeTestSectionDef[],
  answers: Record<string, unknown>,
  currentSectionIndex: number,
): number {
  if (sections.length === 0) return 0;
  const done = sections.reduce((sum, s, i) => {
    const answered = s.questions.filter((q) => answers[q.id] !== undefined).length;
    const share = s.questions.length ? answered / s.questions.length : 1;
    return sum + (i < currentSectionIndex ? 1 : i === currentSectionIndex ? share : 0);
  }, 0);
  return Math.min(100, Math.round((done / sections.length) * 100));
}
