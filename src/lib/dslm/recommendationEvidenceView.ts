/** Presentation adapters only: never select a lesson or infer source relationships. */
import type { ExplainableSuggestion, EvidenceType, RecommendationEvidence } from './recommendationExplainability';

export const EVIDENCE_LABELS: Readonly<Record<EvidenceType, string>> = {
  spaced_review: 'Spaced review',
  critical_gap: 'Skill gap',
  goal_milestone: 'Goal milestone',
  teacher_note: 'Teacher observation',
  curriculum_step: 'Planned step',
  diagnostic_baseline: 'Diagnostic baseline',
};

export interface ScopedEvidenceSuggestion extends ExplainableSuggestion {
  id: string;
  student_id: string;
  teacher_id: string;
  suggested_goal?: string | null;
  suggested_grammar_focus?: string | null;
  suggested_additional_info?: string | null;
}

export interface AppliedEvidenceSource {
  studentId: string;
  suggestionId: string;
}

export interface AppliedLessonFields {
  topic: string;
  goal: string;
  grammarFocus: string;
  additionalInfo: string;
}

/** Exact ID and ownership, not a guess based on a similar topic or the first carousel chip. */
export function findEvidenceSuggestion<T extends ScopedEvidenceSuggestion>(
  rows: readonly T[], id: string | null | undefined, studentId: string, teacherId: string,
): T | null {
  if (!id || !studentId || !teacherId) return null;
  const matches = rows.filter(row => row.id === id && row.student_id === studentId && row.teacher_id === teacherId);
  if (matches.length !== 1) return null;
  const row = matches[0];
  return row && !row.is_used && !row.deleted_at ? row : null;
}

/** Hide the passport after changing learner, source text or the source's lifecycle. */
export function resolveAppliedEvidenceSuggestion<T extends ScopedEvidenceSuggestion>(input: {
  source: AppliedEvidenceSource | null;
  rows: readonly T[];
  studentId: string;
  teacherId: string;
  fields: AppliedLessonFields;
}): T | null {
  if (input.source?.studentId !== input.studentId) return null;
  const row = findEvidenceSuggestion(input.rows, input.source.suggestionId, input.studentId, input.teacherId);
  if (!row) return null;
  const text = (value: string | null | undefined) => (value ?? '').trim();
  if (text(row.suggested_topic) !== text(input.fields.topic)
      || text(row.suggested_goal) !== text(input.fields.goal)
      || text(row.suggested_grammar_focus) !== text(input.fields.grammarFocus)
      || text(row.suggested_additional_info) !== text(input.fields.additionalInfo)) return null;
  return row;
}

/** Numeric source facts, kept distinct from a measured learner test score. */
export function evidenceFacts(evidence: RecommendationEvidence): string[] {
  if (evidence.type === 'critical_gap' || evidence.type === 'spaced_review') {
    return [
      `Stored mastery: ${evidence.raw_mastery}%`,
      `Estimated retention: ${evidence.effective_mastery}%`,
      `${evidence.total_events} recorded observation${evidence.total_events === 1 ? '' : 's'}`,
      evidence.days_since_last_event === null ? 'Practice date unknown' : `Last recorded practice: ${evidence.days_since_last_event} days ago`,
      ...(evidence.evidence_strength === 'limited' ? ['Limited evidence'] : []),
    ];
  }
  if (evidence.type === 'curriculum_step') return [`Phase ${evidence.phase_sequence}, step ${evidence.step_sequence}`];
  if (evidence.type === 'diagnostic_baseline') return [`${evidence.scored_count} scored answers / ${evidence.answered_count} answered questions`];
  return [];
}