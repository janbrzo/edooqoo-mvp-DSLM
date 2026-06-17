/**
 * v6.9.61 — Global GeneratingModal mount.
 *
 * Previously the modal was only mounted in Index.tsx, which meant starting
 * a second generation from StudentPage (or any other route) hid the
 * multi-job card switcher. This component mounts the modal once at the App
 * root and feeds it directly from the job registry so it appears on every
 * page in the tab that started the jobs.
 */
import { useEffect, useMemo, useState } from 'react';
import GeneratingModal from '@/components/GeneratingModal';
import { useActiveWorksheetGenerationJobs } from '@/hooks/useActiveWorksheetGenerationJob';
import { useTabId } from '@/lib/worksheet/tabId';
import { useAuthFlow } from '@/hooks/useAuthFlow';

export default function GlobalGeneratingModal() {
  const allJobs = useActiveWorksheetGenerationJobs();
  const tabId = useTabId();
  const { user } = useAuthFlow();
  const [activeJobIdx, setActiveJobIdx] = useState(0);

  const myPollableJobs = useMemo(() => {
    const now = Date.now();
    return allJobs
      // v6.9.62 P1 — accept legacy jobs without an originTabId so multi-job
      // switcher reappears after a refresh on tabs that started >1 job.
      .filter((j) => j.originTabId == null || j.originTabId === tabId)
      .filter((j) =>
        j.status === 'running'
        || (j.status === 'failed' && !!j.recoveryDeadlineAt && now < j.recoveryDeadlineAt),
      )
      .sort((a, b) => a.startedAt - b.startedAt);
  }, [allJobs, tabId]);

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
      isResumed
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