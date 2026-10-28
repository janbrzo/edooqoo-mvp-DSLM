/**
 * v6.9.61: Global GeneratingModal mount.
 *
 * Previously the modal was only mounted in Index.tsx, which meant starting
 * a second generation from StudentPage (or any other route) hid the
 * multi-job card switcher. This component mounts the modal once at the App
 * root and feeds it directly from the job registry so it appears on every
 * page in the tab that started the jobs.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GeneratingModal from '@/components/GeneratingModal';
import { useActiveWorksheetGenerationJobs } from '@/hooks/useActiveWorksheetGenerationJob';
import { useTabId } from '@/lib/worksheet/tabId';
import { isJobResumed } from '@/lib/worksheet/generationJobRegistry';
import { useAuthFlow } from '@/hooks/useAuthFlow';

export default function GlobalGeneratingModal() {
  const allJobs = useActiveWorksheetGenerationJobs();
  const tabId = useTabId();
  const { user } = useAuthFlow();
  const [activeJobIdx, setActiveJobIdx] = useState(0);
  // Jobs the teacher minimized stay in the registry (and show as mini panel
  // cards); only this full-screen view is dismissed. Page-local on purpose: a
  // reload shows the modal again for jobs that are still running.
  const [minimizedJobIds, setMinimizedJobIds] = useState<ReadonlySet<string>>(() => new Set());
  const pageLoadedAtRef = useRef(Date.now());
  const minimizeJob = useCallback((jobId: string) => {
    setMinimizedJobIds((prev) => {
      if (prev.has(jobId)) return prev;
      const next = new Set(prev);
      next.add(jobId);
      return next;
    });
  }, []);
  // Failed jobs stay "recovering" until their recoveryDeadlineAt. Nothing in
  // the registry changes when that deadline passes, so re-render on it, 
  // otherwise the "Checking server…" modal never closes and blocks the page.
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const now = Date.now();
    const deadlines = allJobs
      .filter((j) => j.status === 'failed' && !!j.recoveryDeadlineAt && j.recoveryDeadlineAt > now)
      .map((j) => j.recoveryDeadlineAt as number);
    if (deadlines.length === 0) return;
    const handle = window.setTimeout(() => setClock(Date.now()), Math.min(...deadlines) - now + 50);
    return () => window.clearTimeout(handle);
  }, [allJobs, clock]);

  const myPollableJobs = useMemo(() => {
    const now = Math.max(clock, Date.now());
    return allJobs
      // v6.9.62 P1: accept legacy jobs without an originTabId so multi-job
      // switcher reappears after a refresh on tabs that started >1 job.
      .filter((j) => j.originTabId == null || j.originTabId === tabId)
      .filter((j) => !minimizedJobIds.has(j.jobId))
      .filter((j) =>
        j.status === 'running'
        || (j.status === 'failed' && !!j.recoveryDeadlineAt && now < j.recoveryDeadlineAt),
      )
      .sort((a, b) => a.startedAt - b.startedAt);
  }, [allJobs, tabId, clock, minimizedJobIds]);

  // Auto-focus the newest pollable job when the set grows.
  useEffect(() => {
    if (myPollableJobs.length > 0) setActiveJobIdx(myPollableJobs.length - 1);
    else setActiveJobIdx(0);
  }, [myPollableJobs.length]);

  const safeIdx = Math.min(activeJobIdx, Math.max(0, myPollableJobs.length - 1));
  const activeJob = myPollableJobs[safeIdx] ?? null;

  const modalJobsMeta = useMemo(
    () => myPollableJobs.map((j) => ({
      jobId: j.jobId,
      studentName: j.formMeta?.studentName ?? null,
      topic: j.topic ?? null,
      progress: j.progress
        ? { exercisesGenerated: j.progress.exercisesGenerated, expectedTotal: j.progress.expectedTotal }
        : null,
    })),
    [myPollableJobs],
  );

  if (!activeJob) return null;

  const now = Date.now();
  const isRecovering = activeJob.status === 'failed'
    && !!activeJob.recoveryDeadlineAt
    && now < activeJob.recoveryDeadlineAt;

  return (
    <GeneratingModal
      isOpen
      isResumed={isJobResumed(activeJob, pageLoadedAtRef.current)}
      onMinimize={() => minimizeJob(activeJob.jobId)}
      jobId={activeJob.jobId}
      jobsCount={myPollableJobs.length}
      currentIndex={safeIdx}
      onSelectIndex={setActiveJobIdx}
      jobs={modalJobsMeta}
      studentId={activeJob.studentId ?? null}
      requiresAudio={!!activeJob.formMeta?.requiresAudio}
      requiresImage={!!activeJob.formMeta?.requiresImage}
      hasGrammar={!!activeJob.formMeta?.hasGrammar}
      streamProgress={
        activeJob.progress
          ? {
              exercisesGenerated: activeJob.progress.exercisesGenerated,
              expectedTotal: activeJob.progress.expectedTotal,
            }
          : null
      }
      mediaGenerating={activeJob.progress?.phase === 'media'}
      selectedExercises={activeJob.formMeta?.selectedExercises}
      errorMessage={null}
      recovering={isRecovering}
      onRetry={undefined}
      isAnonymous={!user}
      studentName={activeJob.formMeta?.studentName ?? undefined}
      studentEmail={activeJob.formMeta?.studentEmail ?? null}
      startedAt={activeJob.startedAt}
    />
  );
}