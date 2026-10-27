/**
 * competencyRadar: pure classification of skill categories into competency
 * zones for the Insights radar (Pillar 2, Stage 2.3).
 *
 * Two mastery layers are kept separate on purpose:
 *  - raw: the stored audit-trail mastery (never decayed),
 *  - effective: read-time mastery after the shared forgetting curve.
 * The caller must supply both; this module never applies decay itself
 * (no double-decay) and never reads a clock, React or Supabase.
 *
 * Zone precedence (a category lands in exactly one zone):
 *  1. critical_gap:    effective < 50
 *  2. retention_alert: raw >= 80 and effective < raw (a strong skill is fading)
 *  3. mastered:        effective >= 80
 *  4. in_progress:     everything else
 */
import { isFlashcardSkill, skillLabel } from '../../../supabase/functions/_shared/skillLabels';
import { categoryLabel } from './insightsSummary';

export const CRITICAL_GAP_BELOW = 50;
export const MASTERED_AT_OR_ABOVE = 80;

export type CompetencyZone = 'critical_gap' | 'retention_alert' | 'mastered' | 'in_progress';

export const ZONE_LABELS: Readonly<Record<CompetencyZone, string>> = {
  critical_gap: 'Critical gaps',
  retention_alert: 'Retention alert',
  mastered: 'Mastered',
  in_progress: 'In progress',
};

export interface CompetencySkillInput {
  skill_name: string | null;
  skill_category?: string | null;
  micro_skill?: string | null;
  /** Stored mastery (audit trail). */
  raw_mastery: number | string | null;
  /** Read-time mastery after forgetting. */
  current_mastery: number | string | null;
  total_events?: number | string | null;
  trend?: string | null;
  last_event_at?: string | null;
}

export interface CategoryCompetency {
  category: string;
  label: string;
  rawAvg: number;
  effectiveAvg: number;
  skillCount: number;
  zone: CompetencyZone;
}

export interface FocusSkill {
  skill_name: string;
  label: string;
  category: string;
  effective_mastery: number;
  raw_mastery: number;
  zone: CompetencyZone;
}

function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validSkill(row: CompetencySkillInput): row is CompetencySkillInput & { skill_name: string } {
  if (!row.skill_name || isFlashcardSkill({ skill_name: row.skill_name })) return false;
  const raw = numeric(row.raw_mastery);
  const effective = numeric(row.current_mastery);
  return raw !== null && raw >= 0 && raw <= 100 && effective !== null && effective >= 0 && effective <= 100;
}

export function classifyZone(rawAvg: number, effectiveAvg: number): CompetencyZone {
  if (effectiveAvg < CRITICAL_GAP_BELOW) return 'critical_gap';
  if (rawAvg >= MASTERED_AT_OR_ABOVE && effectiveAvg < rawAvg) return 'retention_alert';
  if (effectiveAvg >= MASTERED_AT_OR_ABOVE) return 'mastered';
  return 'in_progress';
}

/** One row per category that has at least one valid, non-flashcard skill. */
export function buildCategoryCompetencies(
  skills: readonly CompetencySkillInput[] | null | undefined,
): CategoryCompetency[] {
  const buckets = new Map<string, { raw: number[]; effective: number[] }>();
  for (const row of skills ?? []) {
    if (!validSkill(row)) continue;
    const category = row.skill_category || 'other';
    const bucket = buckets.get(category) ?? { raw: [], effective: [] };
    bucket.raw.push(Number(row.raw_mastery));
    bucket.effective.push(Number(row.current_mastery));
    buckets.set(category, bucket);
  }
  const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
  return [...buckets.entries()].map(([category, b]) => {
    const rawAvg = avg(b.raw);
    const effectiveAvg = avg(b.effective);
    return {
      category,
      label: categoryLabel(category),
      rawAvg,
      effectiveAvg,
      skillCount: b.raw.length,
      zone: classifyZone(rawAvg, effectiveAvg),
    };
  });
}

/** Recharts rows: both layers side by side, categories sorted weakest first. */
export function buildRadarRows(competencies: readonly CategoryCompetency[]) {
  return [...competencies]
    .sort((a, b) => a.effectiveAvg - b.effectiveAvg)
    .map((c) => ({ category: c.label, raw: c.rawAvg, effective: c.effectiveAvg, zone: c.zone }));
}

/**
 * The weakest skill inside a category: the concrete "Add to next lesson"
 * target. Lowest effective mastery wins; ties break on lowest raw mastery,
 * then on the skill name for determinism.
 */
export function weakestSkillInCategory(
  skills: readonly CompetencySkillInput[] | null | undefined,
  category: string,
): FocusSkill | null {
  let best: FocusSkill | null = null;
  for (const row of skills ?? []) {
    if (!validSkill(row)) continue;
    if ((row.skill_category || 'other') !== category) continue;
    const raw = Number(row.raw_mastery);
    const effective = Number(row.current_mastery);
    const candidate: FocusSkill = {
      skill_name: row.skill_name,
      label: skillLabel(row.skill_name, row.skill_category, row.micro_skill),
      category,
      effective_mastery: effective,
      raw_mastery: raw,
      zone: classifyZone(raw, effective),
    };
    if (
      !best ||
      candidate.effective_mastery < best.effective_mastery ||
      (candidate.effective_mastery === best.effective_mastery &&
        (candidate.raw_mastery < best.raw_mastery ||
          (candidate.raw_mastery === best.raw_mastery && candidate.skill_name < best.skill_name)))
    ) {
      best = candidate;
    }
  }
  return best;
}

/** Counts per zone, always in a stable order for summary chips. */
export function zoneCounts(competencies: readonly CategoryCompetency[]): Record<CompetencyZone, number> {
  const counts: Record<CompetencyZone, number> = { critical_gap: 0, retention_alert: 0, mastered: 0, in_progress: 0 };
  for (const c of competencies) counts[c.zone] += 1;
  return counts;
}
