/**
 * insightsSummary — plain-language summary for the Learning plan "Insights"
 * segment. Built only from data the page already loads (skill category
 * metrics, Welcome Test profile, behavioural stats); no AI call.
 *
 * No React, no Supabase, no globals — every rule here is unit-testable.
 */

export const SKILL_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  reading: 'Reading',
  speaking: 'Speaking',
  writing: 'Writing',
  listening: 'Listening',
  pronunciation: 'Pronunciation',
  visual_comprehension: 'Visual comprehension',
  other: 'Other',
};

export interface CategorySignal {
  category: string;
  avg_mastery: number;
  total_events: number;
  trend?: string | null;
}

export interface RankedCategory {
  category: string;
  label: string;
  pct: number;
  trend: 'improving' | 'declining' | 'stable';
}

export interface InsightsSummaryInput {
  englishLevel: string | null;
  /** True when a Welcome Test learning profile exists. */
  hasPlacementProfile: boolean;
  estimatedLevel: string | null;
  categories: readonly CategorySignal[] | null | undefined;
  daysSinceLastActivity: number | null;
  homeworkTotal: number;
  homeworkCompleted: number;
}

export interface InsightsSummary {
  lines: string[];
  hasEvidence: boolean;
  ranked: RankedCategory[];
}

export function categoryLabel(category: string): string {
  return SKILL_CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function normalizeTrend(trend: string | null | undefined): RankedCategory['trend'] {
  if (trend === 'improving' || trend === 'declining') return trend;
  return 'stable';
}

/** Categories with real evidence, weakest first (ties by label). */
export function rankCategories(categories: readonly CategorySignal[] | null | undefined): RankedCategory[] {
  return (categories ?? [])
    .filter((c) => c.total_events > 0 && Number.isFinite(c.avg_mastery))
    .map((c) => ({
      category: c.category,
      label: categoryLabel(c.category),
      pct: Math.max(0, Math.min(100, Math.round(c.avg_mastery))),
      trend: normalizeTrend(c.trend),
    }))
    .sort((a, b) => (a.pct !== b.pct ? a.pct - b.pct : a.label.localeCompare(b.label)));
}

function activityPhrase(days: number | null): string | null {
  if (days === null || !Number.isFinite(days)) return null;
  if (days <= 0) return 'Last active today';
  if (days === 1) return 'Last active yesterday';
  return `Last active ${days} days ago`;
}

export function buildInsightsSummary(input: InsightsSummaryInput): InsightsSummary {
  const ranked = rankCategories(input.categories);
  const lines: string[] = [];

  const level = input.englishLevel?.trim();
  const levelPart = level ? `Level ${level} (set by you)` : 'Level not set';
  let placementPart = 'placement test: not taken';
  if (input.hasPlacementProfile) {
    placementPart = input.estimatedLevel
      ? `placement test estimate: ${input.estimatedLevel}`
      : 'placement test: completed';
  }
  lines.push(`${levelPart} · ${placementPart}`);

  if (ranked.length >= 2) {
    const strongest = ranked[ranked.length - 1];
    const weakest = ranked.slice(0, Math.min(2, ranked.length - 1));
    lines.push(
      `Strongest: ${strongest.label} ${strongest.pct}% · Work on: ${weakest
        .map((c) => `${c.label} ${c.pct}%`)
        .join(', ')}`,
    );
  } else if (ranked.length === 1) {
    lines.push(`Only ${ranked[0].label} has evidence so far: ${ranked[0].pct}%`);
  }

  const activity = activityPhrase(input.daysSinceLastActivity);
  const homework = input.homeworkTotal > 0
    ? `homework ${input.homeworkCompleted} of ${input.homeworkTotal} done`
    : null;
  if (activity || homework) {
    lines.push([activity, homework].filter(Boolean).join(' · ').replace(/^homework/, 'Homework'));
  } else {
    lines.push('No lessons, homework or flashcard activity yet');
  }

  return { lines, hasEvidence: ranked.length > 0 || input.hasPlacementProfile, ranked };
}
