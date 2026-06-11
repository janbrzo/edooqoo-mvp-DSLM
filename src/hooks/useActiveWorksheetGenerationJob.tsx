/**
 * v6.9.53 — Drives refresh-safe worksheet generation UI.
 *
 * Subscribes to the localStorage-backed generation job registry and, while a
 * job is `running`, polls the `worksheets` table for the row the backend
 * eventually writes (the SSE stream is gone after refresh, but the backend
 * keeps generating and persists the worksheet itself). On detection it:
 *   - flips `future_worksheet_suggestions.is_used` if applicable
 *   - calls `consume_token` RPC exactly once for authenticated users
 *   - emits `worksheetGenerationSuccess` for the rest of the UI
 *   - moves the job to `completed` so the mini panel switches to its CTA
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  WorksheetGenerationJob,
  completeGenerationJob,
  getActiveGenerationJob,
  markSuggestionUsed,
  markTokenConsumed,
  subscribeToGenerationJob,
} from '@/lib/worksheet/generationJobRegistry';
import { clearAutoGenerateFlags, markPersistentAutoGenerateIntentStatus } from '@/lib/worksheet/autoGenerateBootstrap';
import { devLog, devWarn } from '@/utils/logger';
import { useAuthFlow } from '@/hooks/useAuthFlow';

const POLL_INTERVAL_MS = 5000;
const POLL_LOOKBACK_MS = 30_000;

async function locateBackendWorksheet(job: WorksheetGenerationJob): Promise<string | null> {
  if (!job.teacherId) return null;
  const since = new Date(Math.max(0, job.startedAt - POLL_LOOKBACK_MS)).toISOString();
  let query = supabase
    .from('worksheets')
    .select('id, created_at, student_id')
    .eq('teacher_id', job.teacherId)
    .gte('created_at', since)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);
  if (job.studentId) {
    query = query.eq('student_id', job.studentId);
  }
  const { data, error } = await query;
  if (error) {
    devWarn('[useActiveWorksheetGenerationJob] poll error', error);
    return null;
  }
  return data?.[0]?.id ?? null;
}

async function applyCompletionSideEffects(job: WorksheetGenerationJob, worksheetId: string, userId: string | null) {
  // 1. Mark suggestion as used (best-effort)
  if (job.suggestionId && !job.suggestionMarkedAt) {
    try {
      const { error } = await supabase
        .from('future_worksheet_suggestions')
        .update({ is_used: true, used_worksheet_id: worksheetId, used_at: new Date().toISOString() })
        .eq('id', job.suggestionId);
      if (error) {
        devWarn('[useActiveWorksheetGenerationJob] failed to mark suggestion used', error);
      } else {
        markSuggestionUsed();
        window.dispatchEvent(new CustomEvent('suggestionMarkedUsed', {
          detail: { suggestionId: job.suggestionId, worksheetId },
        }));
      }
    } catch (e) {
      devWarn('[useActiveWorksheetGenerationJob] suggestion update threw', e);
    }
  }

  // 2. Consume token once for authenticated, non-demo users
  if (userId && job.teacherId === userId && !job.tokenConsumedAt && job.origin !== 'anonymous') {
    try {
      const { data, error } = await supabase.rpc('consume_token', {
        p_teacher_id: userId,
        p_worksheet_id: worksheetId,
      });
      if (error) {
        devWarn('[useActiveWorksheetGenerationJob] consume_token error', error);
      } else if (data === true) {
        markTokenConsumed();
      }
    } catch (e) {
      devWarn('[useActiveWorksheetGenerationJob] consume_token threw', e);
    }
  }

  // 3. Notify rest of UI
  try {
    window.dispatchEvent(new CustomEvent('worksheetGenerationSuccess', {
      detail: { worksheetId },
    }));
  } catch (e) {
    devWarn('[useActiveWorksheetGenerationJob] dispatch success failed', e);
  }

  if (job.requestId) {
    markPersistentAutoGenerateIntentStatus(job.requestId, 'completed');
  }
  clearAutoGenerateFlags({ preservePersistent: false });
}

export function useActiveWorksheetGenerationJob() {
  const [job, setJob] = useState<WorksheetGenerationJob | null>(() => getActiveGenerationJob());
  const { user } = useAuthFlow();

  useEffect(() => {
    setJob(getActiveGenerationJob());
    const unsub = subscribeToGenerationJob(setJob);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!job || job.status !== 'running') return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const wsId = await locateBackendWorksheet(job);
      if (cancelled || !wsId) return;
      devLog('[useActiveWorksheetGenerationJob] detected worksheet for active job', { wsId, jobId: job.jobId });
      const next = completeGenerationJob(wsId);
      if (next) {
        await applyCompletionSideEffects(next, wsId, user?.id ?? null);
      }
    };
    // Run an immediate check on mount (covers refresh case)
    void tick();
    const handle = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [job?.jobId, job?.status, user?.id]);

  return job;
}