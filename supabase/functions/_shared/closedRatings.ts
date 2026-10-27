/**
 * Server-side skill ratings of a CLOSED exercise, computed from the stored answers and the
 * homework's own exercise snapshot (never from ratings the browser sent).
 *
 * Mirrors the closed branch of `buildItemEvaluations` in src/utils/masteryCalculator.ts
 * (parity-tested in src/lib/__tests__/closedRatingsParity.test.ts): one rating per nano_skill
 * of every answered item, the key verdict from `calculateItemMastery` (-1 / hasValue=false when
 * the key cannot decide), text confidence from `adjustConfidence`. Pure, no I/O.
 */
import { calculateItemMastery, getExerciseItems } from './itemMastery.ts';

export interface ClosedRating {
  question_index: number;
  name: string;
  reason: string;
  mastery: number;
  hasValue: boolean;
  confidence?: number;
}

const nanoSkillsOf = (item: any): Array<{ name: string; reason: string; confidence?: number }> => {
  const ns = item?.nano_skill ?? item?.nanoSkill;
  if (!ns) return [];
  const list = Array.isArray(ns) ? ns : [ns];
  return list
    .filter((s: any) => s && typeof s === 'object' && s.name)
    .map((s: any) => ({ name: s.name, reason: s.reason || '', confidence: s.confidence }));
};

const isSpeakingName = (n: string) => n.includes('.speaking.') || n.includes('.sp.');
const isWritingName = (n: string) => n.includes('.writing.') || n.includes('.wr.');

/** Typed text answers carry full confidence for writing skills and none for speaking. */
const confidenceFor = (name: string, confidence: number | undefined): number | undefined => {
  const n = name.toLowerCase();
  if (isSpeakingName(n)) return 0.30;
  if (isWritingName(n)) return 0.90;
  return confidence;
};

const hasText = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== '';

export function buildClosedItemEvaluations(
  exerciseType: string,
  exercise: any,
  answers: Record<string | number, any>,
): ClosedRating[] | null {
  if (!exercise || !answers) return null;
  const out: ClosedRating[] = [];
  getExerciseItems(exercise).forEach((item: any, idx: number) => {
    const skills = nanoSkillsOf(item);
    if (skills.length === 0) return;

    let answer = answers[idx];
    // Multi-blank exercises store "idx_blank" keys; any blank counts as the item being answered.
    if ((exerciseType === 'gap-text' || exerciseType === 'fill-in-blanks') && (answer === undefined || answer === null)) {
      const blankKey = Object.keys(answers).find((k) => k.startsWith(`${idx}_`) && /^\d+_\d+$/.test(k) && answers[k] !== undefined);
      if (blankKey) answer = answers[blankKey];
    }
    if (!hasText(answer)) return;

    const key = calculateItemMastery(exerciseType, exercise, idx, answer, answers);
    for (const s of skills) {
      out.push({
        question_index: idx,
        name: s.name,
        reason: s.reason,
        mastery: key !== null ? key : -1,
        hasValue: key !== null && key >= 0,
        confidence: confidenceFor(s.name, s.confidence),
      });
    }
  });
  return out.length > 0 ? out : null;
}
