/**
 * GoalEvidenceAuditor (Goals Step 2): pure, deterministic suggestion of goal progress
 * from DSLM skill metrics. No I/O, caller-supplied `now`, read-time forgetting only.
 *
 * Contract: the result is a teacher-only suggestion. It never writes progress; the
 * saved `manual_progress_pct` / `is_achieved` stay the only values the Student Hub reads.
 */
import { effectiveMastery } from '../../../supabase/functions/_shared/forgetting';
import { canonicalSkill, isExcludedSkillKey, isFlashcardSkill, skillLabel } from '../../../supabase/functions/_shared/skillLabels';

export interface AuditMetric {
  skill_name: string | null;
  skill_category?: string | null;
  micro_skill?: string | null;
  current_mastery: number | string | null;
  /** Present on withEffectiveMastery rows; decay is then applied once from this value. */
  raw_mastery?: number | string | null;
  total_events: number | string | null;
  last_event_at?: string | null;
}

export interface AuditGoal {
  id: string;
  title: string;
  description?: string | null;
  kind?: string | null;
  target_category?: string | null;
  target_date?: string | null;
  created_at?: string | null;
  manual_progress_pct?: number | null;
  is_achieved?: boolean | null;
  archived_at?: string | null;
  deleted_at?: string | null;
  elements?: Array<{ title?: string | null; nano_skill_link?: string | null }> | null;
}

export type AuditConfidence = 'high' | 'medium' | 'low' | 'none';
export type AuditStatus = 'in_progress' | 'ready_to_achieve' | 'at_risk';

export interface AuditSupportingSkill {
  name: string;
  category: string;
  effectiveMastery: number;
  eventsCount: number;
  lastTrainedDaysAgo: number | null;
}

export interface GoalAuditResult {
  goalId: string;
  suggestedProgressPct: number | null;
  currentSavedPct: number | null;
  hasNewEvidence: boolean;
  confidence: AuditConfidence;
  statusRecommendation: AuditStatus;
  matchedSkillsCount: number;
  evidenceCount: number;
  supportingSkills: AuditSupportingSkill[];
  rationale: string;
}

export const AUDIT_THRESHOLDS = {
  /** Events per skill counted toward weight (more repetitions add no extra weight). */
  eventCap: 5,
  /** Skills needed for full coverage; fewer skills scale the suggestion down. */
  fullCoverageSkills: 3,
  /** Minimum difference to the saved value that counts as new evidence. */
  newEvidenceDeltaPct: 10,
  readyPct: 85,
  /** A supporting skill below this effective mastery blocks "ready to achieve". */
  criticalGapMastery: 50,
  atRiskElapsedShare: 0.7,
  atRiskPct: 40,
} as const;

const DAY_MS = 86_400_000;
const SKILL_CATEGORIES = new Set(['grammar', 'vocabulary', 'speaking', 'listening', 'reading', 'writing', 'pronunciation']);
const STOPWORDS = new Set([
  'about', 'able', 'after', 'also', 'and', 'with', 'without', 'into', 'from', 'that', 'this', 'their',
  'they', 'them', 'have', 'more', 'most', 'make', 'when', 'what', 'will', 'would', 'should', 'could',
  'english', 'improve', 'better', 'learn', 'learning', 'practice', 'practise', 'skills', 'skill',
  'level', 'using', 'use', 'own', 'the', 'for', 'can', 'goal', 'student', 'confidently', 'confident',
]);

const tokensOf = (text: string): string[] =>
  String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t))
    .map((t) => (t.length > 5 && t.endsWith('s') ? t.slice(0, -1) : t));

const metricText = (m: AuditMetric): string =>
  `${m.skill_name ?? ''} ${m.micro_skill ?? ''}`.toLowerCase().replace(/[^a-z0-9]+/g, ' ');

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function matchesGoal(m: AuditMetric, goalTokens: string[], links: string[]): boolean {
  const text = metricText(m);
  if (links.some((l) => l && (text.includes(l) || (m.micro_skill && l.includes(String(m.micro_skill).toLowerCase()))))) return true;
  return goalTokens.some((t) => text.includes(t));
}

/** Audits one goal. Returns a teacher-only suggestion; never mutates input. */
export function auditGoal(goal: AuditGoal, metrics: ReadonlyArray<AuditMetric>, now: Date): GoalAuditResult {
  const saved = typeof goal.manual_progress_pct === 'number' ? goal.manual_progress_pct : null;
  const elements = goal.elements || [];
  const goalTokens = Array.from(new Set([
    ...tokensOf(goal.title),
    ...tokensOf(goal.description ?? ''),
    ...elements.flatMap((e) => tokensOf(e.title ?? '')),
  ]));
  const links = elements.map((e) => String(e.nano_skill_link ?? '').toLowerCase().replace(/[._]+/g, ' ').trim()).filter(Boolean);
  const targetCategory = String(goal.target_category ?? '').toLowerCase();
  const categoryFilter = SKILL_CATEGORIES.has(targetCategory) ? targetCategory : null;

  const supporting: AuditSupportingSkill[] = [];
  let weightSum = 0;
  let weighted = 0;
  let evidence = 0;
  for (const m of metrics) {
    if (!m.skill_name || isFlashcardSkill(m)) continue;
    const canon = canonicalSkill(m.skill_name, m.skill_category);
    if (isExcludedSkillKey(canon.exactKey)) continue;
    const events = toNum(m.total_events);
    if (events < 1) continue;
    const category = canon.category ?? String(m.skill_category ?? 'other').toLowerCase();
    if (categoryFilter && category !== categoryFilter) continue;
    if (!matchesGoal(m, goalTokens, links)) continue;
    const raw = m.raw_mastery !== undefined && m.raw_mastery !== null ? m.raw_mastery : m.current_mastery;
    const eff = effectiveMastery(raw, m.last_event_at ?? null, now);
    const lastMs = m.last_event_at ? new Date(m.last_event_at).getTime() : NaN;
    const daysAgo = Number.isFinite(lastMs) ? Math.max(0, Math.floor((now.getTime() - lastMs) / DAY_MS)) : null;
    const w = Math.min(events, AUDIT_THRESHOLDS.eventCap);
    weightSum += w;
    weighted += w * eff;
    evidence += events;
    supporting.push({
      name: skillLabel(m.skill_name, m.skill_category, m.micro_skill),
      category,
      effectiveMastery: Math.round(eff),
      eventsCount: events,
      lastTrainedDaysAgo: daysAgo,
    });
  }
  supporting.sort((a, b) => b.eventsCount - a.eventsCount || a.name.localeCompare(b.name));

  const count = supporting.length;
  let suggested: number | null = null;
  if (count > 0 && weightSum > 0) {
    const mean = weighted / weightSum;
    const coverage = Math.min(1, count / AUDIT_THRESHOLDS.fullCoverageSkills);
    const repetition = Math.min(1, evidence / (AUDIT_THRESHOLDS.fullCoverageSkills * 2));
    suggested = Math.max(0, Math.min(100, Math.round((mean * coverage * (0.5 + 0.5 * repetition)) / 5) * 5));
  }

  let confidence: AuditConfidence = 'none';
  if (count > 0) {
    if (count >= 5 && evidence >= 10) confidence = 'high';
    else if (count >= 3 && evidence >= 6) confidence = 'medium';
    else confidence = 'low';
  }

  let status: AuditStatus = 'in_progress';
  const hasCriticalGap = supporting.some((s) => s.effectiveMastery < AUDIT_THRESHOLDS.criticalGapMastery);
  if (suggested !== null && suggested >= AUDIT_THRESHOLDS.readyPct && !hasCriticalGap && confidence !== 'low') {
    status = 'ready_to_achieve';
  } else if (goal.target_date && goal.created_at) {
    const start = new Date(goal.created_at).getTime();
    const end = new Date(goal.target_date).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      const share = (now.getTime() - start) / (end - start);
      const pct = suggested ?? saved ?? 0;
      if (share >= AUDIT_THRESHOLDS.atRiskElapsedShare && pct < AUDIT_THRESHOLDS.atRiskPct) status = 'at_risk';
    }
  }

  const active = !goal.is_achieved && !goal.archived_at && !goal.deleted_at;
  const hasNewEvidence = active && suggested !== null && confidence !== 'none'
    && (saved === null || Math.abs(suggested - saved) >= AUDIT_THRESHOLDS.newEvidenceDeltaPct);

  const rationale = count === 0
    ? 'No matching practice evidence yet.'
    : `Based on ${count} matching skill${count === 1 ? '' : 's'} across ${evidence} practice event${evidence === 1 ? '' : 's'}, with forgetting applied.`;

  return {
    goalId: goal.id,
    suggestedProgressPct: suggested,
    currentSavedPct: saved,
    hasNewEvidence,
    confidence,
    statusRecommendation: status,
    matchedSkillsCount: count,
    evidenceCount: evidence,
    supportingSkills: supporting.slice(0, 8),
    rationale,
  };
}

export function auditGoals(goals: ReadonlyArray<AuditGoal>, metrics: ReadonlyArray<AuditMetric>, now: Date): Map<string, GoalAuditResult> {
  const out = new Map<string, GoalAuditResult>();
  for (const g of goals) out.set(g.id, auditGoal(g, metrics, now));
  return out;
}
