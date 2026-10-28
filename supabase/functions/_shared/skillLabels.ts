/**
 * skillLabels: read-side canonical skill key and human label (audit A1, stage 1).
 *
 * `student_skill_metrics.skill_name` exists in several naming schemes
 * (`ns.B1.grammar.modal_might`, `ns.grammar.modal_might`, `ns.vocab.x`,
 * `ns.vocabulary.x`, `flashcard:<uuid>`). The SQL engine naming is NOT changed;
 * these helpers only normalise names when metrics are read for prompts, so the
 * same skill stored under two schemes is shown and counted once.
 * D10 stage 2 (option A): after the exact canonical form, a reviewed read-side
 * cluster table (`skillClusters.ts`, generated from a reviewed CSV, HIGH/MED only)
 * pools wording variants of one skill into one key. Stored names stay untouched.
 * Pure TypeScript, no I/O.
 */

import { SKILL_CLUSTERS } from './skillClusters.ts';

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

/** member canonical key -> cluster. Built once from the reviewed table. */
const CLUSTER_BY_MEMBER: ReadonlyMap<string, { key: string; label: string }> = new Map(
  SKILL_CLUSTERS.flatMap((c) => c.members.map((m) => [m, { key: c.key, label: c.label }] as const)),
);

/** Cluster (key + label) of an exact canonical key, or null when it is not in the reviewed table. */
export function clusterForKey(exactKey: string): { key: string; label: string } | null {
  return CLUSTER_BY_MEMBER.get(exactKey) ?? null;
}

/**
 * Data hygiene (D10): keys that are not teachable skills. `other|question_N` are
 * positional fallback names of open answers; `qa.forged*` and `test_item` are test
 * leftovers found in production. They are kept out of weak-area blocks and focus
 * skill candidates (stored rows are not touched).
 */
export const EXCLUDED_SKILL_KEY_PATTERNS: readonly RegExp[] = [
  /^other\|question_\d+$/,
  /^[a-z_]+\|(other\.)?qa\.forged(\.|$)/,
  /^[a-z_]+\|test_item$/,
];

export function isExcludedSkillKey(key: string): boolean {
  return EXCLUDED_SKILL_KEY_PATTERNS.some((re) => re.test(key));
}

export interface CanonicalSkill {
  /** Stable grouping key, e.g. `grammar|modal_might`; the cluster key when the exact key is a reviewed cluster member. */
  key: string;
  /** The exact canonical key before cluster pooling. */
  exactKey: string;
  /** Cluster label when `key` is a cluster key, else null. */
  clusterLabel: string | null;
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
  const exactKey = `${category ?? 'general'}|${rest}`;
  const cluster = clusterForKey(exactKey);
  return { key: cluster ? cluster.key : exactKey, exactKey, clusterLabel: cluster ? cluster.label : null, category, rest };
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
  const category = c.category ? String(c.category).replace(/[\r\n"<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  return category ? `${category}: ${text}` : text;
}

/** micro_skill values that carry no topic (fallbacks, category echoes, flashcards). */
const GENERIC_MICRO_SKILLS = new Set(['', 'grammar', 'grammar_other', 'general', 'other', 'unknown', 'flashcard']);

/**
 * The topic tier of a grammar metric row (`skill_category -> micro_skill -> skill_name`):
 * the lowercase `micro_skill` when the row is a grammar row and the value is a real topic,
 * else null. Other categories echo the category in `micro_skill` and are never grouped by it.
 */
export function grammarMicroSkill(m: { skill_name?: string | null; skill_category?: string | null; micro_skill?: string | null }): string | null {
  const micro = String(m?.micro_skill ?? '').trim().toLowerCase();
  if (GENERIC_MICRO_SKILLS.has(micro) || !/^[a-z0-9_]+$/.test(micro)) return null;
  return canonicalSkill(m?.skill_name, m?.skill_category).category === 'grammar' ? micro : null;
}
