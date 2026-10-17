/**
 * Welcome Test interpretation versioning and trait evidence. Pure (no Deno APIs).
 *
 * Every behaviour change in how answers become traits / scores bumps
 * INTERPRETATION_VERSION. The version is stamped on the stored profile
 * (`traits[INTERPRETATION_VERSION_KEY]`, no new column) so an old profile is
 * rebuilt with the rules it was created under; an unstamped profile is v1.
 *
 * - v1: original mappings (q7 "frustrated with myself" = high anxiety, q4 "ask to
 *   repeat" = high ambiguity tolerance, q4 and q14 both weighed in the LPS).
 * - v2: those two mappings corrected (see V1_MAPPING_OVERRIDES in
 *   welcomeTestTraits.ts) and the q4/q14 scenario counted once (LPS v3 uses q14).
 */

import { TRAIT_QUESTIONS, reconstructTraits } from './welcomeTestTraits.ts';

export const INTERPRETATION_VERSION = 2;
export const INTERPRETATION_VERSION_KEY = '__interpretation_version__';

/** Version of a stored profile: the stamp when it is a positive integer, else 1 (unstamped = v1). */
export function interpretationVersionOf(stored: unknown): number {
  const raw = stored && typeof stored === 'object' ? (stored as Record<string, unknown>)[INTERPRETATION_VERSION_KEY] : stored;
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : 1;
}

export interface TraitEvidence {
  question_id: string;
  /** true when no other answered item measures the same construct (a single question carries the trait). */
  single_item: boolean;
}

/**
 * Traits that measure the same construct with a second item. A trait is
 * `single_item: false` only when its partner trait was reconstructed too.
 * q4/q14 are one scenario asked twice: they corroborate each other but are one
 * piece of behavioural evidence (counted once in the LPS).
 */
export const TRAIT_PARTNERS: Record<string, string> = {
  motivation_type: 'latent_goal',
  latent_goal: 'motivation_type',
  weekly_study_time: 'homework_commitment',
  homework_commitment: 'weekly_study_time',
  feedback_preference: 'correction_preference',
  correction_preference: 'feedback_preference',
  ambiguity_tolerance: 'error_attitude',
  error_attitude: 'ambiguity_tolerance',
};

/**
 * Which question produced each reconstructed trait, and whether it rests on a
 * single item. Uses the same question mapping as `reconstructTraits` (answers
 * only, no client fallback: evidence needs a stored answer).
 */
export function buildTraitEvidence(
  answers: Record<string, unknown> | null | undefined,
  interpretationVersion?: number,
): Record<string, TraitEvidence> {
  const traits = reconstructTraits(answers, null, interpretationVersion);
  const out: Record<string, TraitEvidence> = {};
  for (const trait of Object.keys(traits)) {
    const config = TRAIT_QUESTIONS[trait];
    if (!config) continue;
    const partner = TRAIT_PARTNERS[trait];
    out[trait] = { question_id: config.questionId, single_item: !(partner && traits[partner] !== undefined) };
  }
  return out;
}
