/**
 * useWelcomeTestIntegrity — v6.9.56
 *
 * Lightweight test-integrity layer for the Welcome Test:
 *  - Logs `welcome_test_tab_blur` events to `student_events` whenever the
 *    student switches tabs / loses window focus during the test. The teacher
 *    can later see how often the student looked away (potential AI/translator
 *    use signal).
 *  - Blocks paste into open-ended / speaking-transcript inputs to prevent
 *    one-click translator dumps that defeat the writing assessment.
 *
 * No new tables — `student_events` already exists. We never block tab switches
 * (that would harm UX for students who legitimately need to check a dictionary
 * the teacher allowed). We only RECORD the signal and surface it as part of
 * the AI summary downstream.
 */
import { useEffect, useRef } from 'react';

interface UseWelcomeTestIntegrityArgs {
  enabled: boolean;
  testId: string | null;
  studentId: string | null;
  teacherId: string | null;
  /** When true, paste events are blocked inside the active question. */
  blockPasteOnOpenEnded: boolean;
  /** Current question id for event payload context. */
  currentQuestionId: string | null;
}

const OPEN_ENDED_SELECTOR = 'textarea, input[type="text"]';

const blurStorageKey = (testId: string) => `wt_integrity_${testId}`;

interface IntegrityState {
  blur_count: number;
  blur_events: Array<{ ts: number; reason: string; question_id: string | null }>;
}

const readIntegrity = (testId: string): IntegrityState => {
  try {
    const raw = localStorage.getItem(blurStorageKey(testId));
    if (!raw) return { blur_count: 0, blur_events: [] };
    const parsed = JSON.parse(raw);
    return {
      blur_count: typeof parsed.blur_count === 'number' ? parsed.blur_count : 0,
      blur_events: Array.isArray(parsed.blur_events) ? parsed.blur_events.slice(-50) : [],
    };
  } catch { return { blur_count: 0, blur_events: [] }; }
};

const writeIntegrity = (testId: string, state: IntegrityState) => {
  try { localStorage.setItem(blurStorageKey(testId), JSON.stringify(state)); } catch { /* ignore quota */ }
};

/**
 * Read-and-clear helper used by `useWelcomeTest.completeTest` to attach the
 * integrity snapshot to the final submission payload. Returns `null` when
 * there is nothing to report so the field is omitted from the payload.
 */
export const consumeWelcomeTestIntegrity = (testId: string | null) => {
  if (!testId) return null;
  const snapshot = readIntegrity(testId);
  if (snapshot.blur_count === 0 && snapshot.blur_events.length === 0) return null;
  try { localStorage.removeItem(blurStorageKey(testId)); } catch { /* ignore */ }
  return snapshot;
};

export function useWelcomeTestIntegrity({
  enabled,
  testId,
  studentId,
  teacherId,
  blockPasteOnOpenEnded,
  currentQuestionId,
}: UseWelcomeTestIntegrityArgs) {
  const blurCountRef = useRef(0);

  // 1) Tab-blur / visibility logging.
  useEffect(() => {
    if (!enabled || !testId || !studentId) return;

    const log = (reason: 'visibility_hidden' | 'window_blur') => {
      blurCountRef.current += 1;
      // Anon students can't insert into `student_events` directly (RLS), so we
      // buffer in localStorage and the final `complete-welcome-test` submission
      // forwards the snapshot to `process-welcome-test`, which persists it
      // under `raw_answers.__integrity__` via the service role.
      const current = readIntegrity(testId);
      const next: IntegrityState = {
        blur_count: current.blur_count + 1,
        blur_events: [
          ...current.blur_events,
          { ts: Date.now(), reason, question_id: currentQuestionId },
        ].slice(-50),
      };
      writeIntegrity(testId, next);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') log('visibility_hidden');
    };
    const onBlur = () => log('window_blur');

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled, testId, studentId, currentQuestionId]);

  // 2) Paste blocker for open-ended inputs.
  useEffect(() => {
    if (!enabled || !blockPasteOnOpenEnded) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.matches && target.matches(OPEN_ENDED_SELECTOR)) {
        e.preventDefault();
        // Quiet hint — toast would be overkill on every keystroke.
        (target as HTMLElement).setAttribute('data-paste-blocked', '1');
      }
    };
    document.addEventListener('paste', onPaste, true);
    return () => document.removeEventListener('paste', onPaste, true);
  }, [enabled, blockPasteOnOpenEnded]);
}