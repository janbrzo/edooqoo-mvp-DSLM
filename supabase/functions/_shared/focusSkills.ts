/**
 * focusSkills: server-side validation of the skills a model names for a suggestion
 * (audit A4 / 9.6, decision D14). The model may only pick from the student's real
 * weak skills (the "ALLOWED focusSkills" list in the prompt); anything else is dropped.
 * Pure TypeScript, no I/O.
 */
import { canonicalSkillKey } from './skillLabels.ts';

export const MAX_FOCUS_SKILLS = 4;

export interface AllowedFocusSkill {
  label: string;
  key: string;
}

export interface ResolvedFocusSkills {
  /** Display labels (what the client stores in focus_skill_names). */
  labels: string[];
  /** Canonical keys, same order as labels. */
  keys: string[];
  /** Entries returned by the model that matched nothing (duplicates are not counted). */
  dropped: number;
}

function norm(v: unknown): string {
  return String(v ?? '')
    .toLowerCase()
    .replace(/[<>"`]/g, '')
    .replace(/^[\s\-*•\d.)]+/, '')
    .replace(/[_\s]+/g, ' ')
    .trim();
}

/** Allowed list text for the prompt, one line per skill. */
export function buildAllowedFocusSkillsBlock(allowed: AllowedFocusSkill[]): string {
  if (allowed.length === 0) {
    return 'ALLOWED focusSkills: (none: no measured weak skill). Return "focusSkills": [] for every step.';
  }
  return `ALLOWED focusSkills (copy entries EXACTLY as written, max ${MAX_FOCUS_SKILLS} per step; use [] when the step is not about one of these measured skills; never invent other names):\n${allowed.map((a) => `  - ${a.label}`).join('\n')}`;
}

export function resolveFocusSkills(raw: unknown, allowed: AllowedFocusSkill[], cap = MAX_FOCUS_SKILLS): ResolvedFocusSkills {
  const entries = Array.isArray(raw) ? raw : [];
  const index = new Map<string, AllowedFocusSkill>();
  for (const a of allowed) {
    index.set(norm(a.label), a);
    index.set(norm(a.key.replace('|', ': ')), a);
    index.set(norm(a.key), a);
  }
  const seen = new Set<string>();
  const labels: string[] = [];
  const keys: string[] = [];
  let dropped = 0;
  for (const e of entries) {
    if (typeof e !== 'string' && typeof e !== 'number') { dropped++; continue; }
    const text = String(e);
    let hit = index.get(norm(text));
    if (!hit) {
      const k = canonicalSkillKey(text);
      hit = allowed.find((a) => a.key === k) || index.get(norm(k));
    }
    if (!hit) { dropped++; continue; }
    if (seen.has(hit.key)) continue;
    seen.add(hit.key);
    if (labels.length < cap) { labels.push(hit.label); keys.push(hit.key); }
  }
  return { labels, keys, dropped };
}
