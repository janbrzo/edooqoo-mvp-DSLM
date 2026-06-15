/**
 * v6.9.53 — Global mini panel that keeps the worksheet generation visible
 *            after navigation/refresh mid-generation.
 * v6.9.58 — Multi-job stack. One floating card per concurrent generation,
 *            stacked bottom-right. A given job is hidden only while the
 *            in-page GeneratingModal is mounted for THAT exact jobId.
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  WorksheetGenerationJob,
  clearGenerationJob,
} from '@/lib/worksheet/generationJobRegistry';
import { useActiveWorksheetGenerationJobs } from '@/hooks/useActiveWorksheetGenerationJob';
import { useTabId } from '@/lib/worksheet/tabId';

// v6.9.59 — realistic card height (2-line copy + button) and a slightly
// larger gap so concurrent panels never visually overlap.
const PANEL_HEIGHT_PX = 144;
const PANEL_GAP_PX = 12;
const MAX_VISIBLE_PANELS = 4;

export default function ActiveGenerationMiniPanel() {
  const jobs = useActiveWorksheetGenerationJobs();
  const location = useLocation();
  const navigate = useNavigate();
  const tabId = useTabId();

  // Track which jobIds are currently shown by an in-page modal.
  const [mountedJobIds, setMountedJobIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const onMount = (e: Event) => {
      const id = (e as CustomEvent<{ jobId?: string }>).detail?.jobId;
      if (!id) return;
      setMountedJobIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    };
    const onUnmount = (e: Event) => {
      const id = (e as CustomEvent<{ jobId?: string }>).detail?.jobId;
      if (!id) return;
      setMountedJobIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };
    window.addEventListener('generation-modal:mount', onMount);
    window.addEventListener('generation-modal:unmount', onUnmount);
    return () => {
      window.removeEventListener('generation-modal:mount', onMount);
      window.removeEventListener('generation-modal:unmount', onUnmount);
    };
  }, []);

  const visibleJobs = jobs
    .filter((job) => {
      // v6.9.59 — only hide a running job from the mini panel when its
      // foreground modal lives in THIS tab. Jobs started in another tab
      // must remain visible as mini panels here even if their modal is
      // mounted somewhere else.
      if (
        job.status === 'running'
        && mountedJobIds.has(job.jobId)
        && (job.originTabId ?? null) === tabId
      ) return false;
      if (
        job.status === 'completed'
        && job.worksheetId
        && location.pathname === `/worksheet/${job.worksheetId}`
      ) return false;
      return true;
    })
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-MAX_VISIBLE_PANELS);

  if (visibleJobs.length === 0) return null;

  return (
    <>
      {visibleJobs.map((job, idx) => (
        <MiniPanelCard
          key={job.jobId}
          job={job}
          stackIndex={idx}
          onOpen={() => {
            if (job.worksheetId) {
              navigate(`/worksheet/${job.worksheetId}`);
              clearGenerationJob(job.jobId);
            }
          }}
          onDismiss={() => clearGenerationJob(job.jobId)}
        />
      ))}
    </>
  );
}

function MiniPanelCard({
  job,
  stackIndex,
  onOpen,
  onDismiss,
}: {
  job: WorksheetGenerationJob;
  stackIndex: number;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const isRunning = job.status === 'running';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const bottom = 16 + stackIndex * (PANEL_HEIGHT_PX + PANEL_GAP_PX);
  const studentName = job.formMeta?.studentName;

  return (
    <div
      className={cn(
        'fixed right-4 z-[80] w-[300px] sm:w-[340px] rounded-xl border shadow-lg p-3',
        'bg-background/95 backdrop-blur-md',
        isRunning && 'border-primary/40',
        isCompleted && 'border-emerald-400/60',
        isFailed && 'border-destructive/50',
      )}
      style={{ bottom }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {isRunning && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
          {isCompleted && <Sparkles className="h-5 w-5 text-emerald-500" />}
          {isFailed && <AlertTriangle className="h-5 w-5 text-destructive" />}
        </div>
        <div className="flex-1 min-w-0">
          {isRunning && (
            <>
              <p className="text-sm font-semibold text-foreground leading-tight">
                Worksheet generation in progress
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {studentName ? <>For <span className="font-medium text-foreground">{studentName}</span> · </> : null}
                {job.topic ? `“${job.topic}” — ` : ''}keeps running in the background.
              </p>
            </>
          )}
          {isCompleted && (
            <>
              <p className="text-sm font-semibold text-foreground leading-tight">
                Your worksheet is ready
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {studentName ? <>For <span className="font-medium text-foreground">{studentName}</span>. </> : ''}
                {job.topic ? `“${job.topic}”` : 'Worksheet generated successfully.'}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={onOpen}>
                  Open generated worksheet
                </Button>
              </div>
            </>
          )}
          {isFailed && (
            <>
              <p className="text-sm font-semibold text-foreground leading-tight">
                Generation failed
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {job.errorMessage || 'Please try generating again. No tokens were consumed.'}
              </p>
            </>
          )}
        </div>
        {(isCompleted || isFailed) && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}