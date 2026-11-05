/**
 * Goals Step 3: Deadline & Velocity Assistant (pure, teacher-only).
 *
 * Classifies a goal's trajectory from its window (created_at -> target_date),
 * a progress value (saved manual value or a DSLM suggestion) and a caller-
 * supplied "now". It never writes data: recalibration is a suggestion the
 * teacher applies explicitly. Hard deadlines (exam, interview, presentation)
 * are never proposed for extension; the assistant recommends narrowing scope.
 */

export type VelocityStatus = 'achieved' | 'no_deadline' | 'ahead' | 'on_track' | 'tension' | 'lagging' | 'overdue';
export type DeadlineKind = 'hard' | 'soft';

export interface VelocityInput {
  title: string;
  description?: string | null;
  createdAt: string | null;
  targetDate: string | null;
  progressPct: number | null;
  isAchieved?: boolean;
  now: Date;
}

export interface VelocityResult {
  status: VelocityStatus;
  deadlineKind: DeadlineKind;
  timeElapsedPct: number | null;
  progressPct: number | null;
  velocityRatio: number | null;
  daysLeft: number | null;
  /** ISO date (YYYY-MM-DD) suggested for soft deadlines only. */
  suggestedTargetDate: string | null;
  recommendation: 'none' | 'extend' | 'narrow_scope';
  message: string;
}

const DAY_MS = 86_400_000;
export const ON_TRACK_RATIO = 0.85;
export const LAGGING_RATIO = 0.6;
export const LAGGING_MIN_ELAPSED_PCT = 50;
export const MIN_EXTENSION_DAYS = 7;
export const MAX_EXTENSION_DAYS = 90;

const HARD_DEADLINE_RE = /\b(exam|ielts|toefl|toeic|fce|cae|cpe|pte|certificate|interview|presentation|conference|pitch|meeting|test|relocation|move|trip|flight|wedding)\b/i;

export const classifyDeadlineKind = (title: string, description?: string | null): DeadlineKind =>
  HARD_DEADLINE_RE.test(`${title} ${description ?? ''}`) ? 'hard' : 'soft';

const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);

const base = (kind: DeadlineKind, status: VelocityStatus, message: string, extra: Partial<VelocityResult> = {}): VelocityResult => ({
  status, deadlineKind: kind, timeElapsedPct: null, progressPct: null, velocityRatio: null,
  daysLeft: null, suggestedTargetDate: null, recommendation: 'none', message, ...extra,
});

/** Days needed to finish at the observed pace, clamped to a sane window. */
const extensionDays = (elapsedDays: number, progressPct: number, totalDays: number): number => {
  const remaining = 100 - progressPct;
  const pace = progressPct > 0 ? progressPct / Math.max(elapsedDays, 1) : 0;
  const needed = pace > 0 ? Math.ceil(remaining / pace) : Math.ceil(totalDays * 0.5);
  return Math.min(MAX_EXTENSION_DAYS, Math.max(MIN_EXTENSION_DAYS, needed));
};

export function computeGoalVelocity(input: VelocityInput): VelocityResult {
  const kind = classifyDeadlineKind(input.title, input.description);
  if (input.isAchieved) return base(kind, 'achieved', 'Goal achieved.');
  if (!input.targetDate) return base(kind, 'no_deadline', 'No target date set.');

  const target = new Date(input.targetDate).getTime();
  const nowMs = input.now.getTime();
  const created = input.createdAt ? new Date(input.createdAt).getTime() : NaN;
  if (Number.isNaN(target)) return base(kind, 'no_deadline', 'No target date set.');

  const progress = input.progressPct === null ? null : Math.max(0, Math.min(100, Math.round(input.progressPct)));
  const daysLeft = Math.ceil((target - nowMs) / DAY_MS);

  if (daysLeft < 0) {
    const pct = progress ?? 0;
    const fromNow = Math.min(MAX_EXTENSION_DAYS, Math.max(MIN_EXTENSION_DAYS, Math.ceil((100 - pct) * 0.6)));
    if (kind === 'hard') {
      return base(kind, 'overdue', 'Fixed date has passed. Review the goal or set the next real date.', {
        progressPct: progress, daysLeft, recommendation: 'narrow_scope',
      });
    }
    return base(kind, 'overdue', `Target date passed. Suggest a new date in ${fromNow} days.`, {
      progressPct: progress, daysLeft, recommendation: 'extend',
      suggestedTargetDate: toDateOnly(new Date(nowMs + fromNow * DAY_MS)),
    });
  }

  if (Number.isNaN(created) || target <= created || progress === null) {
    return base(kind, 'on_track', 'Not enough data to assess pace.', { progressPct: progress, daysLeft });
  }

  const totalDays = (target - created) / DAY_MS;
  const elapsedDays = Math.max(0, (nowMs - created) / DAY_MS);
  const elapsedPct = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  const shared = { timeElapsedPct: elapsedPct, progressPct: progress, daysLeft };

  // Too early in the window to judge pace fairly.
  if (elapsedPct < 20) return base(kind, 'on_track', 'Early in the goal window.', shared);

  const ratio = Math.round((progress / Math.max(elapsedPct, 1)) * 100) / 100;
  const withRatio = { ...shared, velocityRatio: ratio };

  if (ratio >= 1.15) return base(kind, 'ahead', 'Ahead of schedule.', withRatio);
  if (ratio >= ON_TRACK_RATIO) return base(kind, 'on_track', 'On track.', withRatio);
  if (ratio < LAGGING_RATIO && elapsedPct > LAGGING_MIN_ELAPSED_PCT) {
    if (kind === 'hard') {
      return base(kind, 'lagging', 'Behind pace for a fixed date. Focus lessons on the most critical gaps.', {
        ...withRatio, recommendation: 'narrow_scope',
      });
    }
    const ext = extensionDays(elapsedDays, progress, totalDays);
    const suggested = new Date(Math.max(target, nowMs) + Math.max(0, ext - daysLeft) * DAY_MS);
    return base(kind, 'lagging', 'Behind pace. Consider moving the target date.', {
      ...withRatio, recommendation: 'extend', suggestedTargetDate: toDateOnly(suggested),
    });
  }
  return base(kind, 'tension', 'Pace needs attention. Prioritise this goal in the next lessons.', withRatio);
}
