/**
 * Pure mapping and formatting for the teacher Profile view (iteration 5, P4).
 *
 * Reads the Welcome Test profile v2 columns defensively: every helper returns
 * null when its data is missing so old profiles render exactly as before.
 */
import type {
  AnswerBehaviour,
  DivergenceSeverity,
  LearningPathResult,
  LearningProfileV2Columns,
  ProfileDivergence,
} from '@/types/dslm/learningProfileV2';

export const LOW_COVERAGE_THRESHOLD = 0.6;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** "career_critical" -> "career critical". */
export const humanize = (value: string): string => value.replace(/_/g, ' ').trim();

const capitalize = (value: string): string => (value ? value[0].toUpperCase() + value.slice(1) : value);

// ---------------------------------------------------------------------------
// Learning path (intensity)
// ---------------------------------------------------------------------------

const asLearningPath = (raw: unknown): LearningPathResult | null => {
  if (!isRecord(raw)) return null;
  const score = isFiniteNumber(raw.score) ? raw.score : null;
  const path = typeof raw.path === 'string' && raw.path ? raw.path : null;
  if (score === null && path === null) return null;
  return raw as unknown as LearningPathResult;
};

/** Prefer the `learning_path` column, fall back to `raw_answers.learning_path` (v1). */
export const resolveLearningPath = (profile: LearningProfileV2Columns | null | undefined): LearningPathResult | null => {
  if (!profile) return null;
  const fromColumn = asLearningPath(profile.learning_path);
  if (fromColumn) return fromColumn;
  const raw = profile.raw_answers;
  return isRecord(raw) ? asLearningPath(raw.learning_path) : null;
};

export const OVERRIDE_LABELS: Record<string, string> = {
  urgent_critical_override: 'Urgent deadline and a career-critical goal raised the path',
  lazy_hobby_override: 'Low persistence with a hobby goal kept the path light',
  urgent_lazy_override: 'Urgent deadline raised the path despite low persistence',
  anxious_notime_override: 'High anxiety and no study time kept the path gentle',
  fossilization_override: 'Over 10 years of learning with low persistence (fossilization risk) kept the path moderate',
  plateau_doubt_prone: 'Tends to doubt themselves on a plateau (path lowered)',
  plateau_intensity_high_grit: 'Works harder on a plateau and shows high grit (path raised)',
  plateau_adaptive: 'Adapts the method on a plateau (path raised)',
  plateau_resilient_intense: 'Resilient on a plateau and prepares intensely (path raised)',
  low_capacity_cap: 'Capped by the declared study capacity',
};

export const overrideLabel = (id: string): string => OVERRIDE_LABELS[id] ?? id;

const PATH_LABELS: Record<string, string> = {
  comfort: 'Comfort',
  guided: 'Guided',
  accelerated: 'Accelerated',
  target: 'Target',
};

export interface LearningPathView {
  version: number;
  pathLabel: string | null;
  score: number | null;
  /** 0..100, null when the result carries no coverage (v1). */
  coveragePercent: number | null;
  /** Empty for v1 results (unanswered signals were stored as 50). */
  topComponents: { name: string; label: string; score: number }[];
  overrides: string[];
  capacityWarning: string | null;
}

export const UNREALISTIC_GOAL_WARNING = "Declared study capacity looks too low for this goal's urgency";

export const describeLearningPath = (lp: LearningPathResult | null): LearningPathView | null => {
  if (!lp) return null;
  const components = isRecord(lp.component_scores) ? lp.component_scores : {};
  const version = isFiniteNumber(lp.version) ? lp.version : 1;
  // v1 scored every unanswered signal as 50, so its "strongest" list could show
  // defaults as measurements: only v2 (missing = null) lists components.
  const topComponents = version < 2 ? [] : Object.entries(components)
    .filter((entry): entry is [string, number] => isFiniteNumber(entry[1]))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, score]) => ({ name, label: capitalize(humanize(name)), score: Math.round(score) }));

  const overrides = Array.isArray(lp.overrides_applied)
    ? lp.overrides_applied.filter((o): o is string => typeof o === 'string' && o.length > 0).map(overrideLabel)
    : [];

  return {
    version,
    pathLabel: typeof lp.path === 'string' && lp.path ? PATH_LABELS[lp.path] ?? capitalize(humanize(lp.path)) : null,
    score: isFiniteNumber(lp.score) ? Math.round(lp.score) : null,
    coveragePercent: isFiniteNumber(lp.coverage) ? Math.round(Math.max(0, Math.min(1, lp.coverage)) * 100) : null,
    topComponents,
    overrides,
    capacityWarning: lp.capacity_warning === 'unrealistic_goal' ? UNREALISTIC_GOAL_WARNING : null,
  };
};

// ---------------------------------------------------------------------------
// Badges: AI fallback and signal coverage
// ---------------------------------------------------------------------------

/** True when the stored `ai_summary` JSON is the deterministic fallback. */
export const isFallbackSummary = (aiSummary: unknown): boolean => {
  if (isRecord(aiSummary)) return aiSummary.fallback === true;
  if (typeof aiSummary !== 'string' || !aiSummary.trim().startsWith('{')) return false;
  try {
    const parsed: unknown = JSON.parse(aiSummary);
    return isRecord(parsed) && parsed.fallback === true;
  } catch {
    return false;
  }
};

/** `signal_coverage`, else `learning_path.coverage`; null when neither is stored. */
export const resolveSignalCoverage = (profile: LearningProfileV2Columns | null | undefined): number | null => {
  if (!profile) return null;
  if (isFiniteNumber(profile.signal_coverage)) return profile.signal_coverage;
  // numeric columns can come back from PostgREST as strings
  if (typeof profile.signal_coverage === 'string') {
    const n = Number(profile.signal_coverage);
    if (Number.isFinite(n)) return n;
  }
  const lp = resolveLearningPath(profile);
  return lp && isFiniteNumber(lp.coverage) ? lp.coverage : null;
};

export const isLowSignalCoverage = (coverage: number | null): boolean =>
  coverage !== null && coverage < LOW_COVERAGE_THRESHOLD;

// ---------------------------------------------------------------------------
// Declared vs measured
// ---------------------------------------------------------------------------

export const DIVERGENCE_PAIR_LABELS: Record<string, string> = {
  level: 'Level',
  motivation: 'Motivation',
  capacity: 'Study capacity',
  confidence_reading: 'Reading confidence',
  confidence_writing: 'Writing confidence',
  confidence_speaking: 'Speaking confidence',
  anxiety: 'Anxiety',
  metacognition: 'Self-awareness',
};

export const SEVERITY_LABELS: Record<DivergenceSeverity, string> = {
  info: 'Info',
  notable: 'Notable',
  strong: 'Strong',
};

export interface DivergenceRow {
  key: string;
  /** Raw pair name and the original server text, for readable formatting and feedback keys. */
  pair: string;
  index: number;
  rawDeclared: string;
  rawObserved: string;
  label: string;
  declared: string;
  observed: string;
  severity: DivergenceSeverity;
  severityLabel: string;
}

const SEVERITIES: DivergenceSeverity[] = ['info', 'notable', 'strong'];

const asText = (v: unknown): string | null => {
  if (typeof v === 'string' && v.trim()) return humanize(v);
  if (isFiniteNumber(v)) return String(v);
  return null;
};

/** Valid rows only, strongest first; null when there is nothing to show. */
export const toDivergenceRows = (raw: unknown): DivergenceRow[] | null => {
  if (!Array.isArray(raw)) return null;
  const rows: DivergenceRow[] = [];
  raw.forEach((item: unknown, index) => {
    if (!isRecord(item)) return;
    const d = item as Partial<ProfileDivergence>;
    const declared = asText(d.declared);
    const observed = asText(d.observed);
    if (typeof d.pair !== 'string' || !declared || !observed) return;
    const severity: DivergenceSeverity = SEVERITIES.includes(d.severity as DivergenceSeverity)
      ? (d.severity as DivergenceSeverity)
      : 'info';
    rows.push({
      key: `${d.pair}-${index}`,
      pair: d.pair,
      index,
      rawDeclared: typeof d.declared === 'string' ? d.declared : declared,
      rawObserved: typeof d.observed === 'string' ? d.observed : observed,
      label: DIVERGENCE_PAIR_LABELS[d.pair] ?? capitalize(humanize(d.pair)),
      declared,
      observed,
      severity,
      severityLabel: SEVERITY_LABELS[severity],
    });
  });
  if (rows.length === 0) return null;
  return rows.sort((a, b) => SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity));
};

// ---------------------------------------------------------------------------
// Answer behaviour
// ---------------------------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Short parts for one line, e.g. ["Answered 18 of 20 skill items", "2 skipped", ...]. */
export const describeAnswerBehaviour = (raw: unknown): string[] | null => {
  if (!isRecord(raw)) return null;
  const ab = raw as Partial<AnswerBehaviour>;
  const parts: string[] = [];
  if (isFiniteNumber(ab.keyed_total) && ab.keyed_total > 0 && isFiniteNumber(ab.keyed_answered)) {
    parts.push(`Answered ${ab.keyed_answered} of ${ab.keyed_total} skill items`);
  }
  if (isFiniteNumber(ab.skip_count_skill)) parts.push(`${plural(ab.skip_count_skill, 'skill item', 'skill items')} skipped`);
  if (isFiniteNumber(ab.idk_count_skill)) parts.push(`${ab.idk_count_skill} "I don't know"`);
  if (isFiniteNumber(ab.median_seconds_keyed)) {
    parts.push(`median ${Math.round(ab.median_seconds_keyed)} s per skill item`);
  }
  if (isFiniteNumber(ab.rushed_count)) parts.push(`${plural(ab.rushed_count, 'rushed answer', 'rushed answers')} (under 3 s)`);
  return parts.length > 0 ? parts : null;
};
