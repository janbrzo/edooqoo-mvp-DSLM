/**
 * resolveDeadline: the single definition of "how many weeks until the deadline"
 * for generate-timeline and generate-curriculum-phases (audit B9).
 *
 * Precedence: students.main_goal_target_date when it is still ahead, else the
 * earliest open goal date that is still ahead. A date that has already passed is
 * never turned into "1 week": it is reported as `overdue` so the prompt can say
 * so and the teacher gets a reminder to set a new date.
 * Pure (no Deno APIs, no I/O).
 */

const DAY_MS = 86400000;

export type DeadlineSource = 'student.main_goal_target_date' | 'goal.target_date' | 'fallback_no_deadline';

export interface DeadlineGoalInput {
  id?: string | null;
  title?: string | null;
  target_date?: string | null;
  is_achieved?: boolean | null;
}

export interface OverdueDeadline {
  kind: 'main_goal' | 'goal';
  goalId: string | null;
  title: string | null;
  date: string;
  daysOverdue: number;
}

export interface ResolvedDeadline {
  /** Weeks to plan against (>= 1); null when no deadline is ahead. */
  weeksUntilDeadline: number | null;
  daysUntilDeadline: number | null;
  /** The date the weeks were computed from, as stored. */
  date: string | null;
  source: DeadlineSource;
  /** True when at least one open deadline has passed. */
  overdue: boolean;
  overdueDeadlines: OverdueDeadline[];
}

/** Midnight UTC of the calendar day of `ms`. */
function dayStart(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** Whole calendar days from today to `date` (negative = passed), null for an unparseable date. */
export function calendarDaysUntil(date: string, now: number): number | null {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.round((dayStart(t) - dayStart(now)) / DAY_MS);
}

function weeksFromDays(days: number): number {
  return Math.max(1, Math.round(days / 7));
}

export function resolveDeadline(
  student: { main_goal_target_date?: string | null } | null | undefined,
  goals: readonly DeadlineGoalInput[] | null | undefined,
  now: number = Date.now(),
): ResolvedDeadline {
  const overdueDeadlines: OverdueDeadline[] = [];
  const ahead: { days: number; date: string; source: DeadlineSource }[] = [];

  const mainDate = student?.main_goal_target_date || null;
  if (mainDate) {
    const days = calendarDaysUntil(mainDate, now);
    if (days !== null) {
      if (days < 0) overdueDeadlines.push({ kind: 'main_goal', goalId: null, title: null, date: mainDate, daysOverdue: -days });
      else ahead.push({ days, date: mainDate, source: 'student.main_goal_target_date' });
    }
  }
  const goalAhead: { days: number; date: string }[] = [];
  for (const g of goals || []) {
    if (!g?.target_date || g.is_achieved) continue;
    const days = calendarDaysUntil(g.target_date, now);
    if (days === null) continue;
    if (days < 0) {
      overdueDeadlines.push({ kind: 'goal', goalId: g.id ?? null, title: g.title ?? null, date: g.target_date, daysOverdue: -days });
    } else {
      goalAhead.push({ days, date: g.target_date });
    }
  }
  if (goalAhead.length > 0) {
    const first = goalAhead.reduce((a, b) => (b.days < a.days ? b : a));
    ahead.push({ days: first.days, date: first.date, source: 'goal.target_date' });
  }

  // The main goal date wins while it is ahead, else the earliest goal date.
  const chosen = ahead.find((a) => a.source === 'student.main_goal_target_date') || ahead[0] || null;
  return {
    weeksUntilDeadline: chosen ? weeksFromDays(chosen.days) : null,
    daysUntilDeadline: chosen ? chosen.days : null,
    date: chosen ? chosen.date : null,
    source: chosen ? chosen.source : 'fallback_no_deadline',
    overdue: overdueDeadlines.length > 0,
    overdueDeadlines,
  };
}

/** Prompt lines stating that a deadline passed (empty when none did). */
export function overduePromptText(d: ResolvedDeadline): string {
  if (!d.overdue) return '';
  const items = d.overdueDeadlines
    .map((o) => `${o.kind === 'main_goal' ? 'main goal' : `goal "${String(o.title || 'untitled').slice(0, 60)}"`} (${o.date}, ${o.daysOverdue} day${o.daysOverdue === 1 ? '' : 's'} ago)`)
    .join('; ');
  return `\n- DEADLINE PASSED: ${items}. This is not a reason to compress the plan into a short sprint. Do not invent urgency from it; plan at a normal pace and say in the rationale that the teacher should set a new date.`;
}

/** Teacher-facing reminder for the response payload; null when nothing is overdue. */
export function deadlineReminder(d: ResolvedDeadline): { message: string; overdueDeadlines: OverdueDeadline[] } | null {
  if (!d.overdue) return null;
  const first = d.overdueDeadlines[0];
  const more = d.overdueDeadlines.length > 1 ? ` (and ${d.overdueDeadlines.length - 1} more)` : '';
  const what = first.kind === 'main_goal' ? 'The main goal date' : `The date of goal "${String(first.title || 'untitled').slice(0, 60)}"`;
  return {
    message: `${what} (${first.date}) passed ${first.daysOverdue} day${first.daysOverdue === 1 ? '' : 's'} ago${more}. The plan was not rushed because of it. Set a new date or mark the goal achieved.`,
    overdueDeadlines: d.overdueDeadlines,
  };
}

/**
 * Goals as the prompt should see them: an overdue date is not shown as a
 * [DEADLINE: ...] to meet (that would again push the model to rush); it is noted
 * in the description instead.
 */
export function goalsForPrompt<T extends DeadlineGoalInput & { description?: string | null }>(
  goals: readonly T[] | null | undefined,
  now: number = Date.now(),
): T[] {
  return (goals || []).map((g) => {
    if (!g?.target_date) return g;
    const days = calendarDaysUntil(g.target_date, now);
    if (days === null || days >= 0) return g;
    const note = `date ${g.target_date} has passed, awaiting a new date`;
    return { ...g, target_date: null, description: g.description ? `${g.description} (${note})` : note };
  });
}
