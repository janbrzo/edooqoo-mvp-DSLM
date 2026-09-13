/**
 * studentSnapshot — pure data rules for the Student Workspace frame (v6.9.111, M3).
 *
 * `StudentHeaderBar` and `StudentSnapshotPanel` must stay presentational, so
 * every decision about *what* the teacher sees lives here: which knowledge
 * entries count as focus areas, how they are ordered and trimmed, and how a
 * booked lesson is phrased.
 *
 * No React, no Supabase, no globals — every rule below is unit-testable.
 */

import type { StudentKnowledgeEntry } from '@/types/studentKnowledge';

/** Slot shape shared with the calendar: `YYYY-MM-DD` + `HH:MM[:SS]`. */
export interface StudentNextLesson {
  date: string;
  time: string;
}

/** Skill subtypes that represent "something to work on". `strength` never does. */
const FOCUS_SUBTYPES = new Set(['weakness', 'mistake', 'practice']);

export const MAX_FOCUS_AREAS = 3;
export const FOCUS_LABEL_MAX_LEN = 60;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function firstLine(raw: string): string {
  return raw.split('\n')[0].trim();
}

function truncate(label: string, max = FOCUS_LABEL_MAX_LEN): string {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1).trimEnd()}…`;
}

/** Sort key: most recently touched first, falling back to creation time. */
function recency(entry: StudentKnowledgeEntry): string {
  return entry.updated_at || entry.created_at || '';
}

/**
 * Up to three short "what to work on" labels for the snapshot panel.
 *
 * Only active Skill Assessment entries qualify: soft-deleted, outdated and
 * archived rows are ignored, as are strengths. The label prefers the precise
 * `metadata.nano_skill` and falls back to the first line of the note.
 * Case-insensitive duplicates collapse to their most recent occurrence.
 */
export function selectFocusAreas(
  entries: readonly StudentKnowledgeEntry[] | null | undefined,
  limit: number = MAX_FOCUS_AREAS,
): string[] {
  if (!entries || entries.length === 0) return [];

  const candidates = entries.filter((entry) => {
    if (entry.category !== 'Skill Assessment') return false;
    if (entry.deleted_at) return false;
    if (entry.is_outdated) return false;
    if (entry.archived_at) return false;
    const subtype = entry.metadata?.skill_subtype;
    return !!subtype && FOCUS_SUBTYPES.has(subtype);
  });

  // Deterministic ordering: newest signal wins, ties broken by id so repeated
  // renders never reshuffle the chips.
  const ordered = [...candidates].sort((a, b) => {
    const byRecency = recency(b).localeCompare(recency(a));
    return byRecency !== 0 ? byRecency : a.id.localeCompare(b.id);
  });

  const seen = new Set<string>();
  const labels: string[] = [];

  for (const entry of ordered) {
    const raw = (entry.metadata?.nano_skill || entry.content || '').trim();
    if (!raw) continue;
    const label = firstLine(raw);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(truncate(label));
    if (labels.length >= limit) break;
  }

  return labels;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Parse `YYYY-MM-DD` as a local calendar day — never through UTC. */
function parseLocalDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const parsed = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * `Today 18:00` / `Tomorrow 18:00` / `Tue 18:00`.
 * Returns `null` when there is no booked lesson or the row is malformed —
 * the header then renders "No lesson booked".
 */
export function formatNextLessonLabel(
  lesson: StudentNextLesson | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!lesson?.date || !lesson?.time) return null;

  const day = parseLocalDate(lesson.date);
  if (!day) return null;

  const hhmm = lesson.time.trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (sameDay(day, today)) return `Today ${hhmm}`;
  if (sameDay(day, tomorrow)) return `Tomorrow ${hhmm}`;
  return `${WEEKDAYS[day.getDay()]} ${hhmm}`;
}

/** `MMM d, yyyy` for the goal deadline row; `null` when unset or malformed. */
export function formatDeadline(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const day = parseLocalDate(raw.slice(0, 10));
  if (!day) return null;
  const month = day.toLocaleDateString('en-US', { month: 'short' });
  return `${month} ${day.getDate()}, ${day.getFullYear()}`;
}

/**
 * Student Hub status for the snapshot: the hub works off the student email,
 * so presence of an email is the whole signal. Overdue-email preferences are
 * a separate setting and deliberately not folded in here.
 */
export function describeHubStatus(hubEmail: string | null | undefined): {
  enabled: boolean;
  label: string;
  email: string | null;
} {
  const email = hubEmail?.trim() || null;
  return {
    enabled: !!email,
    label: email ? 'Enabled' : 'Not set',
    email,
  };
}
