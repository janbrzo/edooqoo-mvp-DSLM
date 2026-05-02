/**
 * useGoalProgress — DSLM v5.0
 *
 * Computes a 0-100 progress percentage per goal by combining three signals:
 *  1. Element ratings: average of (current_rating × 20) across the goal's learning elements.
 *  2. Skill mastery match: if an element title substring-matches a skill_name or micro_skill in
 *     student_skill_metrics, use that mastery instead of the rating-based score.
 *  3. Manual override (manual_progress_pct): final = MAX(computed, manual). Manual can lift,
 *     never hide objective progress.
 *
 * Returns null when no signals exist (no rated elements, no skill match, no manual override).
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SkillMetric {
  skill_name: string | null;
  micro_skill: string | null;
  current_mastery: number | null;
}

interface MinimalElement {
  id: string;
  title: string;
  current_rating: number | null;
  nano_skill_link?: string | null;
}

export interface MinimalGoal {
  id: string;
  title: string;
  manual_progress_pct?: number | null;
  elements?: MinimalElement[] | null;
}

export interface GoalProgressResult {
  pct: number | null;
  isManualOverride: boolean;
  signalsLabel: string;
}

const matchSkill = (
  elementTitle: string,
  nanoSkillLink: string | null | undefined,
  metrics: SkillMetric[],
): number | null => {
  // First try a precise match via nano_skill_link → micro_skill (if element is tagged)
  if (nanoSkillLink) {
    const lk = nanoSkillLink.toLowerCase();
    for (const m of metrics) {
      if (m.micro_skill && (m.micro_skill.toLowerCase().includes(lk) || lk.includes(m.micro_skill.toLowerCase()))) {
        if (typeof m.current_mastery === 'number') return m.current_mastery;
      }
    }
  }
  if (!elementTitle) return null;
  const lower = elementTitle.toLowerCase();
  for (const m of metrics) {
    const keys = [m.skill_name, m.micro_skill].filter(Boolean) as string[];
    for (const k of keys) {
      const lk = k.toLowerCase();
      if (lower.includes(lk) || lk.includes(lower)) {
        if (typeof m.current_mastery === 'number') return m.current_mastery;
      }
    }
  }
  return null;
};

const computePct = (goal: MinimalGoal, metrics: SkillMetric[]): GoalProgressResult => {
  const els = goal.elements || [];
  const manual = typeof goal.manual_progress_pct === 'number' ? goal.manual_progress_pct : null;

  if (els.length === 0) {
    if (manual !== null) {
      return { pct: manual, isManualOverride: true, signalsLabel: 'manual override only' };
    }
    return { pct: null, isManualOverride: false, signalsLabel: '' };
  }

  let skillMatches = 0;
  let ratingCount = 0;
  const scores: number[] = [];
  for (const el of els) {
    const skillScore = matchSkill(el.title, (el as any).nano_skill_link, metrics);
    if (skillScore !== null) {
      skillMatches++;
      scores.push(skillScore);
      continue;
    }
    if (typeof el.current_rating === 'number' && el.current_rating > 0) {
      ratingCount++;
      scores.push(el.current_rating * 20);
    }
  }

  if (scores.length === 0) {
    if (manual !== null) {
      return { pct: manual, isManualOverride: true, signalsLabel: 'manual override only' };
    }
    return { pct: null, isManualOverride: false, signalsLabel: '' };
  }

  const computed = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const final = manual !== null ? Math.max(computed, manual) : computed;
  const labelParts: string[] = [];
  if (ratingCount > 0) labelParts.push(`${ratingCount} rating${ratingCount > 1 ? 's' : ''}`);
  if (skillMatches > 0) labelParts.push(`${skillMatches} skill${skillMatches > 1 ? 's' : ''}`);
  return {
    pct: final,
    isManualOverride: manual !== null && final === manual && manual > computed,
    signalsLabel: labelParts.join(' + '),
  };
};

export const useGoalProgress = (
  goals: MinimalGoal[],
  studentId: string,
  teacherId: string,
) => {
  const [metrics, setMetrics] = useState<SkillMetric[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!studentId || !teacherId) { setMetrics([]); return; }
    (async () => {
      const { data, error } = await supabase
        .from('student_skill_metrics' as any)
        .select('skill_name, micro_skill, current_mastery')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId);
      if (cancelled) return;
      if (error) { setMetrics([]); return; }
      setMetrics((data || []) as any);
    })();
    return () => { cancelled = true; };
  }, [studentId, teacherId]);

  const map = useMemo(() => {
    const m = new Map<string, GoalProgressResult>();
    for (const g of goals) m.set(g.id, computePct(g, metrics));
    return m;
  }, [goals, metrics]);

  // Aggregate "main" pseudo-goal across all goals (for Main Goal banner).
  const mainAggregate = useMemo<GoalProgressResult>(() => {
    const allEls = goals.flatMap(g => g.elements || []);
    if (allEls.length === 0) return { pct: null, isManualOverride: false, signalsLabel: '' };
    return computePct({ id: 'main', title: 'main', elements: allEls, manual_progress_pct: null }, metrics);
  }, [goals, metrics]);

  return { map, mainAggregate };
};