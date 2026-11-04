/**
 * useGoalEvidenceAudit: teacher-only goal progress suggestions from DSLM evidence.
 * Reuses the cached plan evidence read (demo-guarded) and the pure auditor.
 * Nothing is saved here; the caller applies a suggestion only on a teacher action.
 */
import { useMemo } from 'react';
import { usePlanEvidenceMetrics } from '@/hooks/dslm/usePlanEvidenceMetrics';
import { auditGoals, type AuditGoal, type GoalAuditResult } from '@/lib/dslm/goalEvidenceAuditor';

export function useGoalEvidenceAudit(goals: ReadonlyArray<AuditGoal>, studentId: string, teacherId: string) {
  const { metrics, loaded } = usePlanEvidenceMetrics(studentId, teacherId);
  const auditMap = useMemo<Map<string, GoalAuditResult>>(
    () => (loaded ? auditGoals(goals, metrics, new Date()) : new Map()),
    [goals, metrics, loaded],
  );
  const pending = useMemo(() => Array.from(auditMap.values()).filter((r) => r.hasNewEvidence), [auditMap]);
  return { auditMap, pending, pendingAuditsCount: pending.length, loaded };
}
