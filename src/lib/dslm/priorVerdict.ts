/**
 * Validation loop v1: what the Mark done form showed the teacher before any
 * change (`p_prior_verdict` of save_mark_done_evaluation). Without it a saved
 * default cannot be told from a real correction. Pure, no I/O.
 *
 * The source order mirrors `calculateInitialMasteryForItem`
 * (src/utils/masteryCalculator.ts): saved teacher ratings, live AI, stored
 * evaluation (AI queue or ai_alternative raise), answer key, nothing.
 */

export type PrefillSource =
  | 'saved_teacher'
  | 'ai_live'
  | 'stored_ai_alternative'
  | 'stored'
  | 'key'
  | 'none';

export interface PriorVerdictItem {
  name: string;
  item_index: number;
  prefill_mastery: number | null;
  prefill_source: PrefillSource;
  /** Answer key verdict on the 0-100 scale for closed items (100 correct, 0 wrong), else null. */
  key_mastery: number | null;
  /** Live AI score of this item, 0-100, or null. */
  ai_score: number | null;
  stored_mastery: number | null;
  /** `source` of the stored evaluation (for example `ai_alternative`), or null. */
  stored_source: string | null;
  /** Value the teacher saved; filled by `finalizePriorVerdict`. */
  final_mastery?: number;
  changed?: boolean;
}

export interface PriorVerdict {
  version: 1;
  items: PriorVerdictItem[];
}

const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export function describePrefillItem(args: {
  name: string;
  itemIndex: number;
  mastery: number | null;
  hasValue: boolean;
  fromSavedRatings: boolean;
  aiEvaluations?: Record<number, number> | null;
  storedEvaluations?: Record<number, number> | null;
  storedSources?: Record<number, string> | null;
  keyMastery?: number | null;
}): PriorVerdictItem {
  const ai = args.aiEvaluations?.[args.itemIndex];
  const stored = args.storedEvaluations?.[args.itemIndex];
  const storedSource = args.storedSources?.[args.itemIndex] ?? null;
  let source: PrefillSource;
  if (args.fromSavedRatings) source = args.hasValue ? 'saved_teacher' : 'none';
  else if (!args.hasValue || args.mastery === null) source = 'none';
  else if (isScore(ai)) source = 'ai_live';
  else if (typeof stored === 'number') source = storedSource === 'ai_alternative' ? 'stored_ai_alternative' : 'stored';
  else source = 'key';
  return {
    name: args.name,
    item_index: args.itemIndex,
    prefill_mastery: args.hasValue ? args.mastery : null,
    prefill_source: source,
    key_mastery: isScore(args.keyMastery) ? args.keyMastery : null,
    ai_score: isScore(ai) ? ai : null,
    stored_mastery: typeof stored === 'number' ? stored : null,
    stored_source: storedSource,
  };
}

/** Maximum items sent; a mark done form has far fewer skills. */
export const PRIOR_VERDICT_MAX_ITEMS = 60;

/**
 * Pairs the prefill snapshot (same order as the form rows) with the submitted
 * ratings. Only rows the teacher saved (hasValue) are kept, each with the saved
 * value and whether it differs from the prefill.
 */
export function finalizePriorVerdict(
  prefill: ReadonlyArray<PriorVerdictItem> | null | undefined,
  rows: ReadonlyArray<{ mastery: number | null; hasValue: boolean }>,
): PriorVerdict | null {
  if (!prefill || prefill.length === 0 || prefill.length !== rows.length) return null;
  const items: PriorVerdictItem[] = [];
  rows.forEach((row, i) => {
    if (!row.hasValue || row.mastery === null) return;
    const p = prefill[i];
    items.push({ ...p, final_mastery: row.mastery, changed: p.prefill_mastery !== row.mastery });
  });
  if (items.length === 0) return null;
  return { version: 1, items: items.slice(0, PRIOR_VERDICT_MAX_ITEMS) };
}
