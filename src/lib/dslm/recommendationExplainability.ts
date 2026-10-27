/**
 * Read-only evidence for an existing lesson suggestion, not a recommendation engine.
 * Current signals support a focus; they do not prove what caused an AI generation.
 * All time comes from the caller. No I/O, global clock, scoring or queue changes.
 */
import { effectiveMastery } from '../../../supabase/functions/_shared/forgetting';
import { canonicalSkillKey, isFlashcardSkill, skillLabel } from '../../../supabase/functions/_shared/skillLabels';
import { isActiveGoal } from './goals';

export type EvidenceType =
  | 'spaced_review'
  | 'critical_gap'
  | 'goal_milestone'
  | 'teacher_note'
  | 'curriculum_step'
  | 'diagnostic_baseline';

export interface ExplainableSuggestion {
  id?: string | null;
  suggested_topic?: string | null;
  focus_skill_names?: readonly string[] | null;
  phase_id?: string | null;
  sequence_number?: number | null;
  is_used?: boolean | null;
  deleted_at?: string | null;
}

export interface ExplainabilityMetric {
  skill_name: string | null;
  skill_category?: string | null;
  micro_skill?: string | null;
  current_mastery: number | string | null;
  /** Present on withEffectiveMastery rows: use this to avoid applying decay twice. */
  raw_mastery?: number | string | null;
  total_events: number | string | null;
  trend?: string | null;
  last_event_at?: string | null;
}

export interface ExplainabilityGoal {
  id: string;
  title: string;
  target_date?: string | null;
  is_achieved: boolean;
  archived_at?: string | null;
  deleted_at?: string | null;
  source?: string | null;
  accepted_at?: string | null;
}

export interface ExplainabilityNote {
  id: string;
  category: string;
  entry_source: string;
  created_at: string;
  is_outdated: boolean;
  deleted_at?: string | null;
  archived_at?: string | null;
  used_in_worksheet_id?: string | null;
}

export interface ExplainabilityPhase {
  id: string;
  title: string;
  sequence_number: number;
  status: string;
  deleted_at?: string | null;
}

export interface ExplainabilityDiagnostic {
  id: string;
  status: string;
  completed_at: string | null;
  /** Real answered/scored denominators, never a count of all assigned questions. */
  answered_count: number;
  scored_count: number;
}

interface EvidenceBase {
  type: EvidenceType;
  summary: string;
  /** Explicit linkage is not itself proof of a model's internal reasoning. */
  basis: 'current_signal' | 'linked_record';
}

interface SkillEvidenceFacts {
  /** Original stored name and hierarchy, not a renamed canonical key. */
  skill_name: string;
  skill_category: string | null;
  micro_skill: string | null;
  label: string;
  raw_mastery: number;
  effective_mastery: number;
  total_events: number;
  evidence_strength: 'limited' | 'established';
  last_event_at: string | null;
  days_since_last_event: number | null;
}

export type RecommendationEvidence =
  | (EvidenceBase & SkillEvidenceFacts & {
      type: 'critical_gap';
      basis: 'current_signal';
      trigger: 'low_mastery' | 'declining' | 'retention_drop';
    })
  | (EvidenceBase & SkillEvidenceFacts & { type: 'spaced_review'; basis: 'current_signal' })
  | (EvidenceBase & { type: 'goal_milestone'; basis: 'linked_record'; goal_id: string; days_until_target: number | null })
  | (EvidenceBase & { type: 'teacher_note'; basis: 'linked_record'; note_id: string; category: string; observed_at: string })
  | (EvidenceBase & { type: 'curriculum_step'; basis: 'linked_record'; suggestion_id: string; phase_id: string; phase_sequence: number; step_sequence: number })
  | (EvidenceBase & { type: 'diagnostic_baseline'; basis: 'linked_record'; test_id: string; completed_at: string; answered_count: number; scored_count: number });

export interface RecommendationExplainabilityInput {
  suggestion: ExplainableSuggestion | null | undefined;
  now: Date | number;
  metrics?: readonly ExplainabilityMetric[] | null;
  goals?: readonly ExplainabilityGoal[] | null;
  notes?: readonly ExplainabilityNote[] | null;
  phases?: readonly ExplainabilityPhase[] | null;
  diagnostics?: readonly ExplainabilityDiagnostic[] | null;
  /** Supplied only when an explicit source relationship is known by the caller.
   * Existing generation_context counts, titles and rationale do not establish it.
   */
  linkedGoalIds?: readonly string[] | null;
  linkedNoteIds?: readonly string[] | null;
  linkedDiagnosticTestId?: string | null;
}

export interface RecommendationExplanation {
  status: 'supported' | 'insufficient_evidence';
  primary: RecommendationEvidence | null;
  evidence: RecommendationEvidence[];
  summary: string | null;
}

const DAY_MS = 86_400_000;
const CRITICAL_MASTERY = 50;
const STRONG_MASTERY = 80;
const REVIEW_AGE_DAYS = 30;
const ESTABLISHED_EVENTS = 4;

function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Null for duplicate identities: choosing one would silently resolve conflicting evidence. */
function uniqueById<T extends { id: string }>(rows: readonly T[]): Map<string, T | null> {
  const result = new Map<string, T | null>();
  for (const row of rows) result.set(row.id, result.has(row.id) ? null : row);
  return result;
}

function indexMetric(map: Map<string, ExplainabilityMetric | null>, key: string, row: ExplainabilityMetric) {
  map.set(key, map.has(key) ? null : row);
}

/** Linear in supplied records plus targeted skills; input ordering breaks ties.
 * Reasons are supporting evidence only. The caller still owns lesson selection.
 */
export function explainRecommendation(input: RecommendationExplainabilityInput): RecommendationExplanation {
  const empty = (): RecommendationExplanation => ({ status: 'insufficient_evidence', primary: null, evidence: [], summary: null });
  const s = input.suggestion;
  const now = input.now instanceof Date ? input.now.getTime() : input.now;
  if (!s || s.is_used || s.deleted_at || !Number.isFinite(now)) return empty();

  const evidence: RecommendationEvidence[] = [];
  const exact = new Map<string, ExplainabilityMetric | null>();
  const canonical = new Map<string, ExplainabilityMetric | null>();
  for (const row of input.metrics ?? []) {
    if (!row.skill_name || isFlashcardSkill(row)) continue;
    indexMetric(exact, row.skill_name, row);
    indexMetric(canonical, canonicalSkillKey(row.skill_name, row.skill_category), row);
  }
  const seenSkills = new Set<string>();
  const gaps: RecommendationEvidence[] = [];
  const reviews: RecommendationEvidence[] = [];
  for (const target of s.focus_skill_names ?? []) {
    // Prefer a unique exact name; tolerate a legacy alias only if unambiguous.
    const row = exact.has(target) ? exact.get(target) : canonical.get(canonicalSkillKey(target));
    if (!row?.skill_name || seenSkills.has(row.skill_name)) continue;
    seenSkills.add(row.skill_name);
    const raw = numeric(row.raw_mastery === undefined ? row.current_mastery : row.raw_mastery);
    const events = numeric(row.total_events);
    if (raw === null || raw < 0 || raw > 100 || events === null || !Number.isInteger(events) || events < 1) continue;
    const last = timestamp(row.last_event_at);
    // Malformed/future timestamps cannot support recency, decay or freshness.
    const validLast = last !== null && last <= now ? last : null;
    const effective = effectiveMastery(raw, validLast === null ? null : row.last_event_at, now);
    const age = validLast === null ? null : (now - validLast) / DAY_MS;
    const label = skillLabel(row.skill_name, row.skill_category, row.micro_skill);
    const facts: SkillEvidenceFacts = {
      skill_name: row.skill_name,
      skill_category: row.skill_category ?? null,
      micro_skill: row.micro_skill ?? null,
      label,
      raw_mastery: raw,
      effective_mastery: effective,
      total_events: events,
      evidence_strength: events >= ESTABLISHED_EVENTS ? 'established' : 'limited',
      last_event_at: validLast === null ? null : row.last_event_at ?? null,
      days_since_last_event: age === null ? null : Math.floor(age),
    };
    const trigger = effective < CRITICAL_MASTERY ? 'low_mastery'
      : row.trend === 'declining' && events >= ESTABLISHED_EVENTS ? 'declining'
      : raw > STRONG_MASTERY && effective <= STRONG_MASTERY ? 'retention_drop' : null;
    if (trigger) {
      gaps.push({ type: 'critical_gap', basis: 'current_signal', ...facts, trigger,
        summary: trigger === 'declining'
          ? `${label}: recorded performance is declining across ${events} observations.`
          : `${label}: ${effective}% ${effective < raw ? 'estimated retention' : 'recorded mastery'}${events < ESTABLISHED_EVENTS ? ' (limited evidence)' : ''}.`,
      });
    }
    if (raw > STRONG_MASTERY && age !== null && age > REVIEW_AGE_DAYS && effective < raw) {
      reviews.push({ type: 'spaced_review', basis: 'current_signal', ...facts,
        summary: `${label}: last recorded practice ${Math.floor(age)} days ago; estimated retention ${effective}% (stored mastery ${raw}%).`,
      });
    }
  }
  evidence.push(...gaps, ...reviews);

  const goals = uniqueById(input.goals ?? []);
  for (const id of new Set(input.linkedGoalIds ?? [])) {
    const goal = goals.get(id);
    if (!goal || !isActiveGoal(goal) || goal.deleted_at || !goal.title.trim()) continue;
    if (goal.source === 'welcome_test_auto' && !goal.accepted_at) continue;
    // Date-only goal deadlines are compared by UTC calendar day, not local timezone.
    const target = timestamp(goal.target_date);
    const days = target === null ? null : Math.floor(target / DAY_MS) - Math.floor(now / DAY_MS);
    evidence.push({ type: 'goal_milestone', basis: 'linked_record', goal_id: id, days_until_target: days,
      summary: days === null ? 'This lesson is linked to an active learning goal.'
        : days < 0 ? `This lesson is linked to an active goal whose target date passed ${-days} days ago.`
        : days === 0 ? 'This lesson is linked to an active goal with a target date today.'
        : `This lesson is linked to an active goal with a target date in ${days} days.`,
    });
  }

  const notes = uniqueById(input.notes ?? []);
  for (const id of new Set(input.linkedNoteIds ?? [])) {
    const note = notes.get(id);
    const at = timestamp(note?.created_at);
    if (!note || note.entry_source !== 'manual' || note.is_outdated || note.deleted_at || note.archived_at || note.used_in_worksheet_id || at === null || at > now) continue;
    evidence.push({ type: 'teacher_note', basis: 'linked_record', note_id: id, category: note.category, observed_at: note.created_at,
      summary: 'This lesson is linked to a current teacher observation.',
    });
  }

  const phase = s.phase_id ? uniqueById(input.phases ?? []).get(s.phase_id) : null;
  if (phase && !phase.deleted_at && (phase.status === 'planned' || phase.status === 'in_progress')
      && s.id && s.suggested_topic?.trim() && Number.isInteger(s.sequence_number) && (s.sequence_number ?? 0) > 0
      && Number.isInteger(phase.sequence_number) && phase.sequence_number > 0) {
    evidence.push({ type: 'curriculum_step', basis: 'linked_record', suggestion_id: s.id, phase_id: phase.id,
      phase_sequence: phase.sequence_number, step_sequence: s.sequence_number ?? 0,
      summary: `Planned step ${s.sequence_number} in phase ${phase.sequence_number}.`,
    });
  }

  const test = input.linkedDiagnosticTestId ? uniqueById(input.diagnostics ?? []).get(input.linkedDiagnosticTestId) : null;
  const completed = timestamp(test?.completed_at);
  if (test && (test.status === 'completed' || test.status === 'reviewed') && test.completed_at
      && completed !== null && completed <= now && Number.isInteger(test.answered_count) && test.answered_count > 0
      && Number.isInteger(test.scored_count) && test.scored_count > 0 && test.scored_count <= test.answered_count) {
    evidence.push({ type: 'diagnostic_baseline', basis: 'linked_record', test_id: test.id, completed_at: test.completed_at,
      answered_count: test.answered_count, scored_count: test.scored_count,
      summary: `Linked diagnostic baseline: ${test.scored_count} scored answers out of ${test.answered_count} answered questions.`,
    });
  }

  const primary = evidence[0] ?? null;
  return { status: primary ? 'supported' : 'insufficient_evidence', primary, evidence, summary: primary?.summary ?? null };
}