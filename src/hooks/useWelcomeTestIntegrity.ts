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
import { supabase } from '@/integrations/supabase/client';

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
    if (!enabled || !testId || !studentId || !teacherId) return;

    const log = async (reason: 'visibility_hidden' | 'window_blur') => {
      blurCountRef.current += 1;
      try {
        await supabase.from('student_events').insert({
          student_id: studentId,
          teacher_id: teacherId,
          event_source: 'welcome_test',
          event_type: 'welcome_test_tab_blur',
          event_payload: {
            test_id: testId,
            question_id: currentQuestionId,
            reason,
            blur_count_session: blurCountRef.current,
          },
        });
      } catch (err) {
        // Integrity logging is best-effort — never block the test.
        console.warn('[welcome-test-integrity] failed to log blur', err);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void log('visibility_hidden');
    };
    const onBlur = () => { void log('window_blur'); };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [enabled, testId, studentId, teacherId, currentQuestionId]);

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