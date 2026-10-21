/**
 * pacing: the single DSLM pacing module (iteration 5, decision D3).
 *
 * Two separate dimensions:
 *   - STYLE pacing (`students.dslm_pacing_mode`): Scientific (0) to Pragmatic (100).
 *     Computed by `computeStylePacing` (recalculate-pacing and, at prompt time for a
 *     student whose pacing was never set, `computeStylePacingForStudent`).
 *   - INTENSITY: the Welcome Test Learning Path Score (comfort / guided /
 *     accelerated / target). It drives phase count/length and homework load and
 *     NEVER changes the style pacing number. Computed by `computeIntensity`.
 *
 * Pure TypeScript, no Deno APIs: imported by Edge Functions and by vitest.
 */

export function clampPacing(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

const DAY_MS = 86400000;

/** `students.dslm_pacing_mode` column default (read from production, D11); new students are inserted with it. */
export const DEFAULT_PACING_MODE = 50;

// ---------------------------------------------------------------------------
// Style pacing (recalculate-pacing)
// ---------------------------------------------------------------------------

export interface PacingStudent {
  main_goal?: string | null;
  english_level?: string | null;
  main_goal_target_date?: string | null;
}

export interface PacingGoal {
  title?: string | null;
  target_date?: string | null;
}

export interface PacingMetric {
  skill_category?: string | null;
  skill_name?: string | null;
  micro_skill?: string | null;
  current_mastery?: number | string | null;
  trend?: string | null;
  /** Rated events behind current_mastery. Missing on rows from callers written before the evidence gate. */
  total_events?: number | string | null;
}

/**
 * A skill mastery steers pacing only with at least this many rated events behind it
 * (a single 0/100 answer, e.g. from the Welcome Test, is not a mastery).
 */
export const MIN_PACING_EVIDENCE_EVENTS = 3;
/** Minimum number of such skills in a group (input or output) before its average counts. */
export const MIN_PACING_EVIDENCE_SKILLS = 2;

/** Welcome Test profile signals, from real `student_learning_profiles` columns only. */
export interface PacingProfileSignals {
  level_confidence?: string | null;
  anxiety_level?: string | null;
  error_attitude?: string | null;
  weekly_study_time?: string | null;
  /**
   * Triangulated study capacity (LPS `capacity`: weekly time with the q5c
   * homework scenario, plus persistence from v3). When present it replaces the
   * raw declared `weekly_study_time` in style pacing, so a declared "2-3 hours"
   * cannot push the style when the learner's homework behaviour says otherwise.
   */
  capacity?: 'low' | 'normal' | 'high' | null;
}

export interface StylePacingInput {
  student: PacingStudent;
  /** Active goals (not deleted, not archived, not achieved). Goals without target_date are ignored. */
  goals?: PacingGoal[] | null;
  /** Skill metrics updated in the last 30 days, most recent first. */
  metrics?: PacingMetric[] | null;
  profile?: PacingProfileSignals | null;
  /** Self-Profile map: field -> raw value (see `selfProfileFromEntries`). */
  selfProfile?: Record<string, unknown> | null;
  now: Date | number;
}

export interface StylePacingResult {
  pacing: number;
  reasoning: string[];
  /** Shortest deadline in days across main goal date and active goals, null when none. */
  deadlineDays: number | null;
}

/**
 * Builds the Self-Profile map from `student_knowledge_entries` rows
 * (category 'Self-Profile'). The first entry per field wins, as before.
 */
export function selfProfileFromEntries(
  entries: Array<{ metadata?: any; content?: unknown }> | null | undefined,
): Record<string, unknown> {
  const sp: Record<string, unknown> = {};
  for (const e of entries || []) {
    const f = e?.metadata?.field;
    if (f && sp[f] === undefined) sp[f] = e?.metadata?.raw_value ?? e?.content;
  }
  return sp;
}

// v6.8.6: Self-Profile mapper aligned with src/constants/studentSelfProfile.ts.
// Source of truth = the UI enum. Legacy values from older entries are
// normalised via alias dictionaries (zero-data-migration backward compat).
const LEGACY_OBSTACLE_ALIASES: Record<string, string> = {
  'Lack of time': 'Time',
  'Tiredness': 'Time',
  'Anxiety': 'Confidence',
  'Fear of mistakes': 'Confidence',
};
const LEGACY_MOTIVATION_ALIASES: Record<string, string> = {
  'Career advancement': 'Career growth',
  'Job change': 'Career growth',
  'Exam preparation': 'Specific exam',
};
const LEGACY_STYLE_ALIASES: Record<string, string> = {
  'Conversation-first': 'Auditory',
  'Grammar-first': 'Reading-Writing',
};
const normalizeAlias = (v: unknown, dict: Record<string, string>): string =>
  typeof v === 'string' ? (dict[v] ?? v) : '';

function toMs(now: Date | number): number {
  return typeof now === 'number' ? now : now.getTime();
}

/** Days from `now` to `date`, rounded (negative = overdue). */
export function daysUntil(date: string, now: Date | number): number {
  return Math.round((new Date(date).getTime() - toMs(now)) / DAY_MS);
}

/** Shortest deadline (days) across students.main_goal_target_date and active goals. */
export function shortestDeadlineDays(
  student: PacingStudent,
  goals: PacingGoal[] | null | undefined,
  now: Date | number,
): number | null {
  const all = deadlineDaysList(student, goals, now);
  return all.length > 0 ? Math.min(...all) : null;
}

function deadlineDaysList(
  student: PacingStudent,
  goals: PacingGoal[] | null | undefined,
  now: Date | number,
): number[] {
  const out: number[] = [];
  if (student?.main_goal_target_date) out.push(daysUntil(student.main_goal_target_date, now));
  for (const g of goals || []) {
    if (g?.target_date) out.push(daysUntil(g.target_date, now));
  }
  return out.filter((d) => Number.isFinite(d)); // an unparseable date is no deadline
}

/** A goal date passed more than this many days ago is stale, not urgent. */
export const STALE_DEADLINE_DAYS = 14;

/**
 * Style pacing (Scientific 0 to Pragmatic 100) from goals, deadlines, level,
 * mastery, trend, the Welcome Test profile and the Self-Profile.
 *
 * Deadline handling (W3a N2): the deadline step runs LAST so no later signal can
 * pull a <=2 week deadline below 100 or a <=30 day deadline below 75.
 */
export function computeStylePacing(input: StylePacingInput): StylePacingResult {
  const { student, now } = input;
  const reasoning: string[] = [];
  let p = 50;

  // Goal keywords
  const goal = (student?.main_goal || '').toLowerCase();
  if (/academic|exam|cae|fce|cpe|ielts|toefl/.test(goal)) { p -= 30; reasoning.push('Academic/exam goal → −30 (Scientific)'); }
  if (/work|business|career|travel|conversation|social|meeting|interview/.test(goal)) { p += 20; reasoning.push('Work/travel/conversation goal → +20 (Pragmatic)'); }

  // Scan ALL active goals (main + supporting + additional) and the legacy
  // students.main_goal_target_date. The shortest effective deadline wins.
  const activeGoals = (input.goals || []).filter((g) => g?.target_date);
  const datedDays = deadlineDaysList(student, activeGoals, now);
  // A date long past means the goal was not updated, not that the learner is in a
  // permanent emergency: it is ignored (with a note) instead of pinning 100.
  const staleCount = datedDays.filter((d) => d < -STALE_DEADLINE_DAYS).length;
  const allDeadlineDays = datedDays.filter((d) => d >= -STALE_DEADLINE_DAYS);
  const effectiveDays = allDeadlineDays.length > 0 ? Math.min(...allDeadlineDays) : null;

  // Pressure aggregation across multiple urgent goals (<=90d)
  const urgentCount = allDeadlineDays.filter((d) => d <= 90 && d > 14).length;
  if (urgentCount >= 3) { p += 10; reasoning.push(`${urgentCount} concurrent urgent deadlines (≤90d) → +10`); }
  // Goal title keyword scan
  const goalTitles = activeGoals.map((g) => String(g.title || '').toLowerCase()).join(' ');
  if (/exam|test|certif|ielts|cae|fce|toefl|cpe/.test(goalTitles)) { p -= 15; reasoning.push('Exam/cert keywords in active goals → −15 (Scientific)'); }
  if (/work|business|meeting|interview|presentation|email/.test(goalTitles)) { p += 10; reasoning.push('Work/business keywords in active goals → +10 (Pragmatic)'); }

  // Level
  const lvl = (student?.english_level || '').toUpperCase();
  if (lvl.startsWith('A')) { p -= 10; reasoning.push('Level A1/A2 → −10 (Scientific)'); }

  // Mastery signals
  const arr = Array.isArray(input.metrics) ? input.metrics : [];
  const text = (m: PacingMetric) => `${m.skill_category || ''} ${m.skill_name || ''} ${m.micro_skill || ''}`;
  const isOutput = (m: PacingMetric) => /speak|writ|product/i.test(text(m));
  const isInput = (m: PacingMetric) => /read|listen|recept/i.test(text(m));
  const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  // Only skills with enough rated events, and only groups with enough such skills.
  // A row without total_events (older caller) is not gated.
  const hasEvidence = (m: PacingMetric) =>
    m.total_events === undefined || m.total_events === null || Number(m.total_events) >= MIN_PACING_EVIDENCE_EVENTS;
  const groupAvg = (pick: (m: PacingMetric) => boolean): number | null => {
    const xs = arr.filter((m) => pick(m) && hasEvidence(m)).map((m) => Number(m.current_mastery) || 0);
    return xs.length >= MIN_PACING_EVIDENCE_SKILLS ? avg(xs) : null;
  };
  const outAvg = groupAvg(isOutput);
  const inAvg = groupAvg(isInput);
  if (outAvg !== null && outAvg < 40) { p -= 10; reasoning.push(`Output mastery ${Math.round(outAvg)}% < 40 → −10 (more input)`); }
  if (inAvg !== null && inAvg > 80) { p += 15; reasoning.push(`Input mastery ${Math.round(inAvg)}% > 80 → +15 (more output)`); }

  // Trend signal
  const declining = arr.slice(0, 5).filter((m) => m.trend === 'declining').length;
  if (declining >= 3) { p -= 10; reasoning.push(`${declining}/5 recent skills declining → −10 (consolidate)`); }

  // Welcome Test profile signals (real student_learning_profiles columns).
  const profile = input.profile || {};
  if (profile.anxiety_level === 'high') { p -= 10; reasoning.push('High anxiety (Welcome Test) → −10 (slower, structured)'); }
  if (profile.error_attitude === 'avoidant') { p -= 5; reasoning.push('Avoids mistakes (Welcome Test) → −5 (safer scaffolded progression)'); }
  if (profile.error_attitude === 'comfortable') { p += 5; reasoning.push('Comfortable making mistakes (Welcome Test) → +5 (push output)'); }
  if (profile.level_confidence === 'overestimates') { p -= 5; reasoning.push('Self-overestimates level → −5 (consolidate basics)'); }
  if (profile.level_confidence === 'underestimates') { p += 5; reasoning.push('Self-underestimates level → +5 (push output)'); }

  // Self-Profile signals (Student Hub "Tell us about yourself")
  const sp = input.selfProfile || {};
  const rawObstacles: unknown[] = Array.isArray(sp.learning_obstacles) ? sp.learning_obstacles as unknown[] : [];
  const obstacles: string[] = rawObstacles.map((o) => (typeof o === 'string' ? (LEGACY_OBSTACLE_ALIASES[o] ?? o) : String(o)));
  const motivation = normalizeAlias(sp.motivation_driver, LEGACY_MOTIVATION_ALIASES);
  const style = normalizeAlias(sp.learning_style_pref, LEGACY_STYLE_ALIASES);

  // Obstacles (multi-select). Each independent, additive.
  if (obstacles.includes('Time'))            { p += 8; reasoning.push('Self-reported time constraint → +8 (high-leverage tasks)'); }
  if (obstacles.includes('Confidence'))      { p -= 8; reasoning.push('Low speaking confidence → −8 (safer scaffolded progression)'); }
  if (obstacles.includes('Pronunciation'))   { p -= 3; reasoning.push('Pronunciation focus → −3 (controlled output)'); }
  if (obstacles.includes('Grammar'))         { p -= 5; reasoning.push('Grammar accuracy obstacle → −5 (consolidate rules)'); }
  if (obstacles.includes('Vocabulary'))      { p -= 3; reasoning.push('Vocabulary gap → −3 (input-rich tasks)'); }
  if (obstacles.includes('Listening speed')) { p -= 3; reasoning.push('Listening speed challenge → −3 (slower pacing)'); }

  // Motivation driver (single select). 'Daily life' = neutral.
  if (motivation === 'Career growth') { p += 5;  reasoning.push('Career-driven motivation → +5 (real-world Pragmatic)'); }
  if (motivation === 'Specific exam') { p -= 10; reasoning.push('Exam-driven motivation → −10 (Scientific structure)'); }
  if (motivation === 'Travel')        { p += 3;  reasoning.push('Travel goal → +3 (conversational priority)'); }
  if (motivation === 'Hobby')         { p -= 3;  reasoning.push('Hobby motivation → −3 (comfortable pace)'); }

  // Learning style preference (single select).
  if (style === 'Auditory')        { p += 5; reasoning.push('Auditory learner → +5 (conversation-heavy)'); }
  if (style === 'Kinesthetic')     { p += 5; reasoning.push('Kinesthetic learner → +5 (role-play, doing)'); }
  if (style === 'Visual')          { p -= 3; reasoning.push('Visual learner → −3 (structured input)'); }
  if (style === 'Reading-Writing') { p -= 5; reasoning.push('Reading-Writing learner → −5 (text-heavy Scientific)'); }

  // Weekly time availability: study time contributes in exactly ONE place.
  // Self-Profile slider (1-15h) wins; otherwise the triangulated Welcome Test
  // capacity (q5 with q5c); the raw declared q5 only for profiles without it.
  // error_attitude (q14) is the single source of the q4/q14 scenario here.
  const hours = sp.time_availability_per_week;
  if (typeof hours === 'number') {
    if (hours < 3)      { p -= 5; reasoning.push(`Only ${hours}h/week → −5 (consolidate, don't push)`); }
    else if (hours > 7) { p += 5; reasoning.push(`${hours}h/week available → +5 (sustained Pragmatic load)`); }
  } else if (profile.capacity === 'low' || profile.capacity === 'high' || profile.capacity === 'normal') {
    if (profile.capacity === 'low') { p -= 5; reasoning.push('Low study capacity (Welcome Test, homework behaviour weighed with declared time) → −5 (consolidate, don\'t push)'); }
    else if (profile.capacity === 'high') { p += 5; reasoning.push('High study capacity (Welcome Test, declared time confirmed by homework behaviour) → +5 (sustained Pragmatic load)'); }
  } else {
    const wt = profile.weekly_study_time;
    if (wt === 'none' || wt === '15_30_min') { p -= 5; reasoning.push(`Little study time outside lessons (Welcome Test: ${wt}) → −5 (consolidate, don't push)`); }
    else if (wt === '2_3_hours' || wt === '3_plus_hours') { p += 5; reasoning.push(`Committed study time (Welcome Test: ${wt}) → +5 (sustained Pragmatic load)`); }
  }

  // Deadline-First Override, applied LAST so later signals cannot undercut it.
  // Its line goes FIRST in the reasoning: it decides the value and the UI shows
  // only the first few lines.
  const deadlineLines: string[] = [];
  if (effectiveDays !== null) {
    if (effectiveDays <= 0)        { p = 100;                   deadlineLines.push(`Overdue deadline (${effectiveDays}d) → forced Pragmatic 100`); }
    else if (effectiveDays <= 14)  { p = Math.max(p, 100);      deadlineLines.push(`Deadline ≤2 weeks (${effectiveDays}d) → forced Pragmatic 100 (no time for fundamentals)`); }
    else if (effectiveDays <= 30)  { p = Math.max(p + 25, 75);  deadlineLines.push(`Deadline ≤30 days (${effectiveDays}d) → +25, floor 75 (Pragmatic)`); }
    else if (effectiveDays <= 90)  { p = Math.max(p + 15, 50);  deadlineLines.push(`Deadline ≤90 days (${effectiveDays}d) → +15, floor 50`); }
    else if (effectiveDays <= 180) { p += 5;                    deadlineLines.push(`Deadline ≤180 days (${effectiveDays}d) → +5`); }
    else                           { p -= 5;                    deadlineLines.push(`Deadline >180 days (${effectiveDays}d) → −5 (room for fundamentals)`); }
  }
  if (staleCount > 0) {
    deadlineLines.push(`${staleCount} goal date(s) passed over ${STALE_DEADLINE_DAYS} days ago: ignored, update or archive the goal`);
  }
  reasoning.unshift(...deadlineLines);

  const pacing = clampPacing(p, 0, 100);
  if (reasoning.length === 0) reasoning.push('No strong signals: defaulting near 50.');
  return { pacing, reasoning, deadlineDays: effectiveDays };
}

// ---------------------------------------------------------------------------
// Intensity (Welcome Test Learning Path Score)
// ---------------------------------------------------------------------------

export type IntensityPath = 'comfort' | 'guided' | 'accelerated' | 'target';

export interface IntensityResult {
  intensity: IntensityPath | null;
  score: number | null;
  version: 1 | 2 | 3 | null;
  capacityWarning: string | null;
  reasoning: string[];
}

const INTENSITY_PATHS: readonly IntensityPath[] = ['comfort', 'guided', 'accelerated', 'target'];

function pathFromScore(score: number): IntensityPath {
  if (score >= 76) return 'target';
  if (score >= 51) return 'accelerated';
  if (score >= 26) return 'guided';
  return 'comfort';
}

/**
 * Reads the Learning Path Score (v1 or v2 shape; missing `version` = v1).
 * Intensity is a separate output and never changes the style pacing number.
 */
export function computeIntensity(learningPath: unknown, deadlineDays: number | null): IntensityResult {
  const empty: IntensityResult = { intensity: null, score: null, version: null, capacityWarning: null, reasoning: [] };
  if (!learningPath || typeof learningPath !== 'object' || Array.isArray(learningPath)) return empty;
  const lp = learningPath as Record<string, unknown>;

  const lpVersion = Number(lp.version);
  const version: 1 | 2 | 3 = lpVersion === 3 ? 3 : lpVersion === 2 ? 2 : 1;
  const rawScore = typeof lp.score === 'number' ? lp.score : (typeof lp.score === 'string' && lp.score.trim() !== '' ? Number(lp.score) : NaN);
  const score = Number.isFinite(rawScore) ? Math.round(clampPacing(rawScore, 0, 100)) : null;
  const rawPath = typeof lp.path === 'string' ? lp.path.toLowerCase() : '';
  const intensity: IntensityPath | null = (INTENSITY_PATHS as readonly string[]).includes(rawPath)
    ? rawPath as IntensityPath
    : (score !== null ? pathFromScore(score) : null);
  if (intensity === null && score === null) return { ...empty, version };

  const capacityWarning = version >= 2 && typeof lp.capacity_warning === 'string' && lp.capacity_warning.trim() !== ''
    ? lp.capacity_warning
    : null;

  const reasoning: string[] = [];
  reasoning.push(`Welcome Test Learning Path (v${version}): ${intensity ?? 'unknown'}${score !== null ? ` (score ${score})` : ''} → intensity only, style pacing unchanged`);
  if (version >= 2) {
    const cap = typeof lp.capacity_cap === 'number' ? lp.capacity_cap : null;
    const capacity = typeof lp.capacity === 'string' ? lp.capacity : null;
    if (cap !== null) reasoning.push(`Intensity capped at ${cap} by declared study capacity${capacity ? ` (${capacity})` : ''}`);
  }
  if (capacityWarning) {
    reasoning.push(`Capacity warning (${capacityWarning}): declared study capacity is low for ${deadlineDays !== null ? `a deadline in ${deadlineDays}d` : 'this goal'}`);
  } else if (deadlineDays !== null && deadlineDays <= 30 && (intensity === 'comfort' || intensity === 'guided')) {
    reasoning.push(`Deadline in ${deadlineDays}d with ${intensity} intensity: the deadline drives style, intensity stays within declared capacity`);
  }
  return { intensity, score, version, capacityWarning, reasoning };
}

// ---------------------------------------------------------------------------
// Prompt-time pacing (generate-timeline, generate-curriculum-phases)
// ---------------------------------------------------------------------------

export interface PromptPacingStudent {
  main_goal?: string | null;
  english_level?: string | null;
  dslm_pacing_mode?: number | null;
  /** true: the teacher set it; false: recalculate-pacing (apply) or an accepted proposal wrote it; null: never set. */
  last_pacing_set_manually?: boolean | null;
}

/**
 * Auto pacing used when nobody has set one yet (see resolvePromptPacing). Goal keywords, deadline weeks and level.
 */
export function autoPacingIndex(student: PromptPacingStudent, weeksUntilDeadline: number | null): number {
  let p = 50;
  const goal = (student?.main_goal || '').toLowerCase();

  if (/academic|exam|cae|fce|cpe|ielts|toefl/.test(goal)) p -= 30;
  if (/work|business|career|travel|conversation|social|meeting|interview/.test(goal)) p += 20;

  if (weeksUntilDeadline !== null) {
    if (weeksUntilDeadline <= 8) p += 25;
    else if (weeksUntilDeadline <= 16) p += 15;
  }

  const lvl = (student?.english_level || '').toUpperCase();
  if (lvl.startsWith('A')) p -= 10;

  return clampPacing(p, 0, 100);
}

/**
 * Pacing for a generation prompt (decision D11).
 *
 * - `last_pacing_set_manually` true or false: someone set the value (the teacher,
 *   recalculate-pacing apply, an accepted proposal, the one-off D11 apply): the
 *   stored value is used exactly, even when it is 50.
 * - flag null (never set; the column default is NULL since 20261021090000):
 *   `computed` (the result of `computeStylePacing`, see `computeStylePacingForStudent`)
 *   when the caller has it, else `autoPacingIndex` as the last resort when the
 *   inputs could not be loaded.
 * - flag not selected at all (undefined): the old rule (any value other than 50
 *   counts as set), with `computed` replacing the auto rule.
 */
export function resolvePromptPacing(
  student: PromptPacingStudent,
  weeksUntilDeadline: number | null,
  computed?: number | null,
): number {
  const stored = student?.dslm_pacing_mode;
  const hasStored = typeof stored === 'number' && Number.isFinite(stored);
  const flag = student?.last_pacing_set_manually;
  const fallback = () => (typeof computed === 'number' && Number.isFinite(computed)
    ? clampPacing(computed, 0, 100)
    : autoPacingIndex(student, weeksUntilDeadline));
  if (flag === undefined) {
    if (hasStored && stored !== 50) return clampPacing(stored as number, 0, 100);
    return fallback();
  }
  if (hasStored && typeof flag === 'boolean') return clampPacing(stored as number, 0, 100);
  return fallback();
}

// ---------------------------------------------------------------------------
// Style pacing inputs (shared by recalculate-pacing and the generators)
// ---------------------------------------------------------------------------

export interface StylePacingForStudent {
  style: StylePacingResult;
  profile: LearningProfileForPacing | null;
  /** Non-fatal read problems, for logging. */
  warnings: string[];
}

/**
 * Loads metrics (last 30 days by `last_event_at`), active goals, the Welcome Test
 * profile and the Self-Profile and runs `computeStylePacing`. The single place
 * where style pacing inputs are read, so recalculate-pacing and the prompt-time
 * fallback for never-set students cannot drift. Never throws on read errors
 * (they become warnings and a weaker input); `profile` may be passed when the
 * caller already loaded it.
 */
export async function computeStylePacingForStudent(
  supabase: any,
  student: PacingStudent,
  studentId: string,
  teacherId: string,
  opts: { profile?: LearningProfileForPacing | null; now?: Date | number } = {},
): Promise<StylePacingForStudent> {
  const now = opts.now ?? Date.now();
  const warnings: string[] = [];

  const { data: metrics } = await supabase
    .from('student_skill_metrics')
    .select('*')
    .eq('student_id', studentId)
    .gte('last_event_at', new Date(toMs(now) - 30 * DAY_MS).toISOString())
    .order('last_event_at', { ascending: false })
    .limit(200);

  // Deadline-First Override scans ALL active goals (main + supporting +
  // additional) and the legacy students.main_goal_target_date.
  const { data: progressGoals, error: gErr } = await supabase
    .from('student_progress_goals')
    .select('goal_type, target_date, title, is_achieved, archived_at, deleted_at')
    .eq('student_id', studentId).eq('teacher_id', teacherId)
    .is('deleted_at', null).is('archived_at', null).eq('is_achieved', false);
  if (gErr) warnings.push(`goals read failed: ${gErr.message}`);

  let profile: LearningProfileForPacing | null;
  if (opts.profile !== undefined) {
    profile = opts.profile;
  } else {
    const loaded = await loadLearningProfileForPacing(supabase, studentId, teacherId);
    if (loaded.error) warnings.push(`learning profile read failed: ${loaded.error}`);
    profile = loaded.profile;
  }

  const { data: selfEntries, error: spErr } = await supabase
    .from('student_knowledge_entries')
    .select('metadata, content')
    .eq('student_id', studentId).eq('teacher_id', teacherId)
    .eq('category', 'Self-Profile').is('deleted_at', null);
  if (spErr) warnings.push(`self-profile read failed: ${spErr.message}`);

  const style = computeStylePacing({
    student,
    goals: (progressGoals || []) as PacingGoal[],
    metrics: (Array.isArray(metrics) ? metrics : []) as PacingMetric[],
    profile,
    selfProfile: selfProfileFromEntries((selfEntries || []) as any[]),
    now,
  });
  return { style, profile, warnings };
}

// ---------------------------------------------------------------------------
// Pacing proposals: expiry (decision D11)
// ---------------------------------------------------------------------------

/** A pending pacing proposal older than this many days is expired (hidden, superseded by the next check). */
export const PACING_PROPOSAL_MAX_AGE_DAYS = 14;

export function isPacingProposalExpired(
  createdAt: string | null | undefined,
  now: Date | number = Date.now(),
  maxAgeDays: number = PACING_PROPOSAL_MAX_AGE_DAYS,
): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  return toMs(now) - t > maxAgeDays * DAY_MS;
}

// ---------------------------------------------------------------------------
// Learning profile loader (structural client type, no Deno APIs)
// ---------------------------------------------------------------------------

export interface LearningProfileForPacing extends PacingProfileSignals {
  learning_path: unknown;
}

export interface LoadLearningProfileResult {
  profile: LearningProfileForPacing | null;
  error: string | null;
}

function isMissingColumnError(err: any): boolean {
  if (!err) return false;
  const msg = `${err.message || ''} ${err.details || ''}`;
  return err.code === '42703' || err.code === 'PGRST204' || /learning_path/.test(msg) && /does not exist|could not find/i.test(msg);
}

/** Triangulated capacity stored in the Learning Path (v2 and later), else null. */
export function capacityOfLearningPath(learningPath: unknown): 'low' | 'normal' | 'high' | null {
  if (!learningPath || typeof learningPath !== 'object' || Array.isArray(learningPath)) return null;
  const c = (learningPath as Record<string, unknown>).capacity;
  return c === 'low' || c === 'normal' || c === 'high' ? c : null;
}

/**
 * Loads the Welcome Test signals used by pacing. Reads the `learning_path`
 * column and falls back to `raw_answers->learning_path` (old rows, or the
 * column not migrated yet). Never throws: errors are returned for logging.
 */
export async function loadLearningProfileForPacing(
  supabase: any,
  studentId: string,
  teacherId: string,
): Promise<LoadLearningProfileResult> {
  const base = 'level_confidence, anxiety_level, error_attitude, weekly_study_time, raw_learning_path:raw_answers->learning_path';
  const run = (cols: string) => supabase
    .from('student_learning_profiles')
    .select(cols)
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .maybeSingle();

  try {
    let { data, error } = await run(`${base}, learning_path`);
    if (error && isMissingColumnError(error)) {
      ({ data, error } = await run(base));
    }
    if (error) return { profile: null, error: String(error.message || error) };
    if (!data) return { profile: null, error: null };
    const row = data as Record<string, any>;
    const learningPath = row.learning_path ?? row.raw_learning_path ?? null;
    return {
      profile: {
        level_confidence: row.level_confidence ?? null,
        anxiety_level: row.anxiety_level ?? null,
        error_attitude: row.error_attitude ?? null,
        weekly_study_time: row.weekly_study_time ?? null,
        capacity: capacityOfLearningPath(learningPath),
        learning_path: learningPath,
      },
      error: null,
    };
  } catch (err) {
    return { profile: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** One or two prompt lines for the student profile block; empty when no LPS. */
export function intensityPromptLines(intensity: IntensityResult): string {
  if (!intensity.intensity) return '';
  const score = intensity.score !== null ? ` (score ${intensity.score})` : '';
  let out = `\n- Intensity (Welcome Test Learning Path): ${intensity.intensity}${score}. Use it for lesson density and homework load within the fixed phases and weeks, not for the Scientific/Pragmatic style.`;
  if (intensity.capacityWarning) {
    out += `\n- Capacity warning: declared study capacity is low for this deadline; keep homework realistic and flag the risk.`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Decision 5: the first Welcome Test proposal is applied automatically
// ---------------------------------------------------------------------------

/** `trigger_details.reason` of the applied first-WT proposal (shown by the UI, undoable by the teacher). */
export const WT_INITIAL_AUTO_REASON = 'welcome_test_initial_auto';

export interface InitialAutoApplyInput {
  triggerType: string | null | undefined;
  /** students.last_pacing_set_manually: true = teacher set it, false = computed value written, null = never set. */
  lastPacingSetManually: boolean | null | undefined;
  /** An earlier teacher decision exists for the student (pacing_proposals status accepted, applied, reverted or rejected). */
  hasEarlierAppliedProposal: boolean;
}

/**
 * Decision 5 (owner approved): the FIRST Welcome Test pacing proposal for a
 * student is applied automatically when the teacher never set pacing (flag null
 * or false) and no proposal was accepted or applied before. Retakes (the first
 * one leaves an applied proposal), manual values and any other trigger keep the
 * normal approval flow. `resolvePromptPacing` then uses the stored value because
 * the apply path sets `last_pacing_set_manually = false`.
 */
export function shouldAutoApplyInitialWtPacing(input: InitialAutoApplyInput): boolean {
  if (input.triggerType !== 'placement_test') return false;
  if (input.lastPacingSetManually === true) return false;
  if (input.hasEarlierAppliedProposal) return false;
  return true;
}
