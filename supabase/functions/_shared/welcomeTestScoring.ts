/**
 * Pure helpers for the AI scores of Welcome Test open and speaking items
 * (0-100 scale). No Deno or network imports so vitest can import it.
 *
 * Only these scores are touched: traits, Learning Path Score, divergences,
 * stored answers and the level inputs never pass through here.
 */
import { INJECTION_SCORE_CAP, looksLikeInstructionInjection } from "./promptSafety.ts";

/** Highest score (0-100) an instruction-like answer may keep: same cap as verify-open-answers (0.1 on 0-1). */
export const WELCOME_INJECTION_SCORE_CAP = Math.round(INJECTION_SCORE_CAP * 100);

/** Rounded and clamped 0..100 score, or null when the value is missing or not a finite number. */
export function clampAiScore(raw: unknown): number | null {
  if (typeof raw === "string" && raw.trim() === "") return null;
  if (typeof raw !== "number" && typeof raw !== "string") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Scores for one run. Only ids that were sent for scoring count (the model may
 * echo example ids from the prompt); a missing or non-numeric score stays
 * absent (unevaluated); instruction-like student text is capped.
 * `studentTexts` maps each sent id to the raw text the student produced.
 */
export function acceptAiScores(
  perScores: unknown,
  studentTexts: Record<string, string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!perScores || typeof perScores !== "object" || Array.isArray(perScores)) return out;
  const src = perScores as Record<string, unknown>;
  for (const id of Object.keys(studentTexts)) {
    if (!Object.prototype.hasOwnProperty.call(src, id)) continue;
    let score = clampAiScore(src[id]);
    if (score === null) continue;
    if (looksLikeInstructionInjection(studentTexts[id]) && score > WELCOME_INJECTION_SCORE_CAP) {
      score = WELCOME_INJECTION_SCORE_CAP;
    }
    out[id] = score;
  }
  return out;
}
