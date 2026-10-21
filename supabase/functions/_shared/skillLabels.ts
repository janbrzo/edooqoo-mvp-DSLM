/**
 * skillLabels: read-side canonical skill key and human label (audit A1, stage 1).
 *
 * `student_skill_metrics.skill_name` exists in several naming schemes
 * (`ns.B1.grammar.modal_might`, `ns.grammar.modal_might`, `ns.vocab.x`,
 * `ns.vocabulary.x`, `flashcard:<uuid>`). The SQL engine naming is NOT changed;
 * these helpers only normalise names when metrics are read for prompts, so the
 * same skill stored under two schemes is shown and counted once.
 * Pure TypeScript, no I/O.
 */

const LEVEL_SEGMENT = /^(a1|a2|b1|b2|c1|c2)$/;

/** Category aliases found as the leading segment after `ns.` / the level. */
const CATEGORY_ALIASES: Record<string, string> = {
  grammar: 'grammar',
  vocab: 'vocabulary',
  vocabulary: 'vocabulary',
  reading: 'reading',
  listening: 'listening',
  speaking: 'speaking',
  writing: 'writing',
  spelling: 'spelling',
  pronunciation: 'pronunciation',
};

/** Flashcard skills are word-level memory items, not teachable skills. */
export function isFlashcardSkill(m: { skill_name?: string | null; micro_skill?: string | null }): boolean {
  const name = String(m?.skill_name ?? '').toLowerCase();
  return name.startsWith('flashcard:') || String(m?.micro_skill ?? '').toLowerCase() === 'flashcard';
}

export interface CanonicalSkill {
  /** Stable grouping key, e.g. `grammar|modal_might`. */
  key: string;
  /** Category without the scheme noise, or null when unknown. */
  category: string | null;
  /** Remainder of the name, e.g. `modal_might`. */
  rest: string;
}

/**
 * Strips the `ns.` prefix, the CEFR level segment and the category segment,
 * and maps `vocab` to `vocabulary`. Falls back to the stored category.
 */
export function canonicalSkill(skillName: string | null | undefined, storedCategory?: string | null): CanonicalSkill {
  let parts = String(skillName ?? '').trim().toLowerCase().split('.').filter(Boolean);
  if (parts[0] === 'ns') parts = parts.slice(1);
  if (parts.length && LEVEL_SEGMENT.test(parts[0])) parts = parts.slice(1);
  let category: string | null = null;
  if (parts.length > 1 && CATEGORY_ALIASES[parts[0]]) {
    category = CATEGORY_ALIASES[parts[0]];
    parts = parts.slice(1);
  }
  const stored = String(storedCategory ?? '').trim().toLowerCase();
  if (!category && stored) category = CATEGORY_ALIASES[stored] || stored;
  const rest = parts.join('.').replace(/_v\d+$/, '') || 'general';
  return { key: `${category ?? 'general'}|${rest}`, category, rest };
}

export function canonicalSkillKey(skillName: string | null | undefined, storedCategory?: string | null): string {
  return canonicalSkill(skillName, storedCategory).key;
}

/** Human label: `grammar: modal might`. */
export function skillLabel(skillName: string | null | undefined, storedCategory?: string | null, microSkill?: string | null): string {
  const c = canonicalSkill(skillName, storedCategory);
  let text = c.rest === 'general' && microSkill ? String(microSkill).toLowerCase() : c.rest;
  text = text.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Skill names come from a model; keep the label short and free of markup.
  text = text.replace(/[<>]/g, '').slice(0, 60);
  return c.category ? `${c.category}: ${text}` : text;
}
