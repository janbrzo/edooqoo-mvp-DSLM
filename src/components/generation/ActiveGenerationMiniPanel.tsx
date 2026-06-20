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
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  WorksheetGenerationJob,
  clearGenerationJob,
} from '@/lib/worksheet/generationJobRegistry';
import { useActiveWorksheetGenerationJobs } from '@/hooks/useActiveWorksheetGenerationJob';
import { computeGenerationProgress, estimateDurationSec } from '@/lib/worksheet/computeProgress';

// v6.9.60 — cards now live inside a single flex stack so each card's
// natural height drives layout; concurrent cards always sit adjacent
// with a small fixed gap and never overlap. Cap visible to 4.
const MAX_VISIBLE_PANELS = 4;

export default function ActiveGenerationMiniPanel() {
  const jobs = useActiveWorksheetGenerationJobs();
  const location = useLocation();
  const navigate = useNavigate();

  // v6.9.60 — Track which jobIds have an in-page modal currently mounted on
  // ANY tab. We use this to suppress the mini-card ONLY when the foreground
  // modal of that exact job is showing in this window — so the user does
  // not see a duplicate. Other concurrent jobs remain visible as mini-cards
  // even if one of them is currently the active modal card.
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
      // v6.9.60 — Show running jobs as mini-cards even on the generation
      // page; only hide a completed job's CTA when the user is already
      // viewing that exact worksheet.
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
    <div
      className="fixed right-4 bottom-4 z-[110] flex flex-col-reverse gap-2 pointer-events-none"
      role="status"
      aria-live="polite"
    >
      {visibleJobs.map((job) => (
        <MiniPanelCard
          key={job.jobId}
          job={job}
          onOpen={() => {
            if (job.worksheetId) {
              navigate(`/worksheet/${job.worksheetId}`);
              clearGenerationJob(job.jobId);
            }
          }}
          onDismiss={() => clearGenerationJob(job.jobId)}
        />
      ))}
    </div>
  );
}

function MiniPanelCard({
  job,
  onOpen,
  onDismiss,
}: {
  job: WorksheetGenerationJob;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const isRunning = job.status === 'running';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const studentName = job.formMeta?.studentName;
  const progress = job.progress ?? null;

  // v6.9.62 P5 — live elapsed counter + % for running mini-cards.
  const [elapsedSec, setElapsedSec] = useState<number>(() =>
    Math.max(0, Math.floor((Date.now() - (job.startedAt ?? Date.now())) / 1000)),
  );
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - (job.startedAt ?? Date.now())) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRunning, job.startedAt]);

  // v6.9.65 — Use shared computeGenerationProgress so this mini-panel and
  // the foreground GeneratingModal always show the same %.
  void estimateDurationSec; // keep import side-effect-free
  const pct = computeGenerationProgress(
    { progress: job.progress ?? null, formMeta: job.formMeta ?? null },
    elapsedSec,
  );

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={cn(
        'pointer-events-auto w-[300px] sm:w-[340px] rounded-xl border shadow-lg p-3',
        'bg-background/95 backdrop-blur-md',
        isRunning && 'border-primary/40',
        isCompleted && 'border-emerald-400/60',
        isFailed && 'border-destructive/50',
      )}
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
              <div className="mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-muted-foreground/90">
                <span>{formatElapsed(elapsedSec)} · {pct}%</span>
                {progress && progress.expectedTotal > 0 ? (
                  <span>{progress.exercisesGenerated}/{progress.expectedTotal}</span>
                ) : null}
              </div>
              <Progress value={pct} className="h-1 mt-1" />
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