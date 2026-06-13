/**
 * v6.9.53 — Global mini panel that keeps the worksheet generation visible
 * after the user navigates away from `/` or refreshes the page mid-generation.
 *
 *  - `running`:   non-closable status pill ("generation still in progress")
 *  - `completed`: CTA to open the generated worksheet + closable X
 *  - `failed`:    error message + retry/close
 *
 * Mounted once in `App.tsx` so it is visible across every route. Hides itself
 * on `/worksheet/:id` if that route already shows the generated worksheet,
 * and on `/` while the in-page `GeneratingModal` is on screen.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Sparkles, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  clearGenerationJob,
  getActiveGenerationJob,
} from '@/lib/worksheet/generationJobRegistry';
import { useActiveWorksheetGenerationJob } from '@/hooks/useActiveWorksheetGenerationJob';

export default function ActiveGenerationMiniPanel() {
  const job = useActiveWorksheetGenerationJob();
  const location = useLocation();
  const navigate = useNavigate();

  // Re-evaluate from storage on every route change so a navigation right after
  // completion still picks up the latest status.
  useEffect(() => {
    // touch storage; the hook's subscribe handler updates state.
    getActiveGenerationJob();
  }, [location.pathname]);

  // v6.9.57 — Track whether the in-page GeneratingModal is currently mounted.
  // The old gate hid this panel on `/` by path, which (a) duplicated UI when
  // the modal was rehydrated after refresh and (b) hid the panel on `/` even
  // when the modal was NOT on screen. Event-based gating fixes both.
  const [modalMounted, setModalMounted] = useState(false);
  useEffect(() => {
    const onMount = () => setModalMounted(true);
    const onUnmount = () => setModalMounted(false);
    window.addEventListener('generation-modal:mount', onMount);
    window.addEventListener('generation-modal:unmount', onUnmount);
    return () => {
      window.removeEventListener('generation-modal:mount', onMount);
      window.removeEventListener('generation-modal:unmount', onUnmount);
    };
  }, []);

  const visible = useMemo(() => {
    if (!job) return false;
    // While the actual GeneratingModal is mounted anywhere, do not duplicate.
    if (job.status === 'running' && modalMounted) return false;
    // On the worksheet page for this exact worksheet, the page itself is the CTA.
    if (
      job.status === 'completed'
      && job.worksheetId
      && location.pathname === `/worksheet/${job.worksheetId}`
    ) {
      return false;
    }
    return true;
  }, [job, location.pathname, modalMounted]);

  if (!job || !visible) return null;

  const isRunning = job.status === 'running';
  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';

  const handleOpen = () => {
    if (job.worksheetId) {
      navigate(`/worksheet/${job.worksheetId}`);
      clearGenerationJob();
    }
  };

  const handleDismiss = () => {
    clearGenerationJob();
  };

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-[80] w-[300px] sm:w-[340px] rounded-xl border shadow-lg p-3',
        'bg-background/95 backdrop-blur-md',
        isRunning && 'border-primary/40',
        isCompleted && 'border-emerald-400/60',
        isFailed && 'border-destructive/50',
      )}
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
                {job.topic ? `“${job.topic}” — ` : ''}You can refresh or move around, generation keeps running in the background.
              </p>
            </>
          )}
          {isCompleted && (
            <>
              <p className="text-sm font-semibold text-foreground leading-tight">
                Your worksheet is ready
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {job.topic ? `“${job.topic}”` : 'Worksheet generated successfully.'}
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="h-8 text-xs" onClick={handleOpen}>
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
            onClick={handleDismiss}
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