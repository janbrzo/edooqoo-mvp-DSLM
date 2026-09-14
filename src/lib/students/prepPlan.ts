/**
 * prepPlan — pure data rules for the Prep tab of the Student Workspace
 * (v6.9.111, M4 step 1).
 *
 * `NextLessonCard`, `LastLessonStrip` and `QuickNoteBox` must stay purely
 * presentational, so every decision about *which* topic is proposed, *why* it
 * is proposed and how ages are phrased lives here.
 *
 * No React, no Supabase, no globals — every rule below is unit-testable.
 * The Worksheet Generation Engine is not touched: this module only selects and
 * normalises an existing suggestion row into the payload shape the page
 * already sends to `writeAutoGenerateIntent` / the sessionStorage prefill.
 */

import { formatGoalLabel } from '@/constants/studentGoals';
import type { WorksheetSuggestion } from '@/types/studentProgress';

/** Superset of `WorksheetSuggestion` as returned by `useFutureTimeline`. */
export interface PrepSuggestionInput extends WorksheetSuggestion {
  suggested_additional_info?: string | null;
  suggested_grammar_focus?: string | null;
  suggested_exercise_focus_map?: Record<string, string> | null;
}

export type PrepSuggestionSource = 'phase_step' | 'next_step' | 'fallback';

export interface PrepSuggestion {
  id: string | null;
  topic: string;
  goal: string;
  additionalInfo: string;
  grammarFocus: string;
  exercises: string[];
  exerciseFocusMap: Record<string, 'vocabulary' | 'grammar'>;
  rationale: string | null;
  source: PrepSuggestionSource;
}

export const RATIONALE_MAX_LEN = 160;
export const FALLBACK_TOPIC = 'General practice';
export const NO_SIGNAL_RATIONALE =
  'No signals yet — this is a general practice suggestion.';

function text(raw: string | null | undefined): string {
  return (raw ?? '').trim();
}

/** Keep only the two didactic focus values the generator understands. */
function normalizeFocusMap(
  raw: Record<string, string> | null | undefined,
): Record<string, 'vocabulary' | 'grammar'> {
  const out: Record<string, 'vocabulary' | 'grammar'> = {};
  if (!raw) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (value === 'vocabulary' || value === 'grammar') out[key] = value;
  }
  return out;
}

/** Sequence first, id second — stable across re-renders and refetches. */
function bySequence(a: PrepSuggestionInput, b: PrepSuggestionInput): number {
  const seqA = Number.isFinite(a.sequence_number) ? a.sequence_number : Number.MAX_SAFE_INTEGER;
  const seqB = Number.isFinite(b.sequence_number) ? b.sequence_number : Number.MAX_SAFE_INTEGER;
  if (seqA !== seqB) return seqA - seqB;
  return String(a.id).localeCompare(String(b.id));
}

function firstUsable(
  rows: readonly PrepSuggestionInput[] | null | undefined,
  source: Exclude<PrepSuggestionSource, 'fallback'>,
): PrepSuggestion | null {
  if (!rows || rows.length === 0) return null;

  const candidates = rows
    .filter((row) => !row.is_used && !row.deleted_at && text(row.suggested_topic).length > 0)
    .sort(bySequence);

  const row = candidates[0];
  if (!row) return null;

  return {
    id: row.id ?? null,
    topic: text(row.suggested_topic),
    goal: text(row.suggested_goal),
    additionalInfo: text(row.suggested_additional_info),
    grammarFocus: text(row.suggested_grammar_focus),
    exercises: Array.isArray(row.suggested_exercises) ? row.suggested_exercises : [],
    exerciseFocusMap: normalizeFocusMap(row.suggested_exercise_focus_map),
    rationale: text(row.rationale) || null,
    source,
  };
}

/**
 * The one topic Prep proposes for the next lesson.
 *
 * Phase-bound steps win over free-floating next steps, because they carry the
 * curriculum order the teacher already approved. Used and soft-deleted rows are
 * ignored. When nothing qualifies, the fallback keeps the card useful instead
 * of empty: the first focus area, else the student's main goal, else a generic
 * practice topic.
 */
export function selectPrepSuggestion(
  phaseSteps: readonly PrepSuggestionInput[] | null | undefined,
  nextSteps: readonly PrepSuggestionInput[] | null | undefined,
  fallback: { mainGoal: string | null; focusAreas: readonly string[] },
): PrepSuggestion {
  const picked =
    firstUsable(phaseSteps, 'phase_step') ?? firstUsable(nextSteps, 'next_step');
  if (picked) return picked;

  const mainGoal = text(fallback.mainGoal);
  const goalLabel = mainGoal ? formatGoalLabel(mainGoal) : '';
  const focus = text(fallback.focusAreas?.[0]);

  return {
    id: null,
    topic: focus || goalLabel || FALLBACK_TOPIC,
    goal: goalLabel,
    additionalInfo: '',
    grammarFocus: '',
    exercises: [],
    exerciseFocusMap: {},
    rationale: null,
    source: 'fallback',
  };
}

/** Trim on a word boundary, appending an ellipsis when anything was cut. */
function trimToLength(raw: string, max: number): string {
  if (raw.length <= max) return raw;
  const slice = raw.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const base = lastSpace > max / 2 ? slice.slice(0, lastSpace) : slice;
  return `${base.trimEnd()}…`;
}

/**
 * One sentence answering "why this topic?".
 * AI rationale wins; recent focus areas are the honest fallback; when there is
 * no signal at all we say so instead of inventing a reason.
 */
export function buildRationale(
  suggestion: PrepSuggestion,
  focusAreas: readonly string[],
): string {
  const rationale = text(suggestion.rationale);
  if (rationale) return trimToLength(rationale, RATIONALE_MAX_LEN);

  const areas = (focusAreas ?? []).map((a) => text(a)).filter(Boolean).slice(0, 3);
  if (areas.length > 0) return `Based on recent focus: ${areas.join(', ')}`;

  return NO_SIGNAL_RATIONALE;
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * `Today` / `Yesterday` / `N days ago` / `N weeks ago` / `MMM d, yyyy`.
 * Empty string when the input is missing or unparseable — the caller then
 * renders no meta column at all.
 */
export function formatRelativeAge(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';

  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(parsed).getTime()) / 86_400_000,
  );

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 6) return `${days} days ago`;
  if (days <= 27) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  return `${MONTHS[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
}
