/**
 * useWelcomeTest - Hook for Welcome Test session management
 * Handles answer submission, timing, trait detection, pause/resume
 * Round 6: Removed Quick Version, fixed element_type, enriched payload, fixed dedup
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';
import { estimateMinutesLeft, questionDefsFor, sectionProgress, sectionsFor } from '@/lib/welcomeTest/flow';
import { bankOfRowCount, readWelcomeTestParams, storedQuestionId, type WelcomeTestForm } from '../../supabase/functions/_shared/welcomeTestBank';
import type { Json } from '@/integrations/supabase/types';
import { buildAnswerEvent, buildSkipEvent, toEventQuestion } from '../../supabase/functions/_shared/welcomeTestEventPayload';
import { createEventLogger } from '@/lib/welcomeTest/eventLogRetry';
import { devWarn } from '@/utils/logger';
import { consumeWelcomeTestIntegrity } from '@/hooks/useWelcomeTestIntegrity';
import { checkWelcomeTestKeyedAnswer } from '@/lib/welcomeTest/keyedAnswer';
import { createAnswerSaveQueue, type AnswerSaveQueue, type SaveSnapshot, type SaveState } from '@/lib/welcomeTest/answerSaveQueue';
import { createPendingSaves } from '@/lib/answers/pendingSaves';
import { flushSpeaking } from '@/lib/welcomeTest/speakingFlush';

interface UseWelcomeTestProps {
  shareToken: string | null;
}

interface WelcomeTestState {
  testId: string | null;
  studentId: string | null;
  teacherId: string | null;
  title: string;
  loading: boolean;
  error: string | null;
  answers: Record<string, unknown>;
  currentSectionIndex: number;
  currentQuestionIndex: number;
  completed: boolean;
  submitting: boolean;
  paused: boolean;
  persistedAnsweredCount: number | null;
  isTeacherMode: boolean;
  studentNativeLanguage: string | null;
  /** Question bank and form the test was seeded with (decides definitions, keys and sections). */
  bank: number;
  form: WelcomeTestForm;
}

interface SavePayload {
  questionIndex: number;
  answer: unknown;
  isCorrect: boolean | null;
  timeSpent: number | null;
}

/** Text answers autosave this long after the last keystroke. */
const TEXT_AUTOSAVE_DEBOUNCE_MS = 1200;

// Questions that are text-input based and should only commit on blur/navigate
const TEXT_INPUT_TYPES = new Set(['fill_blank', 'open_ended', 'open_reflection']);

export function useWelcomeTest({ shareToken }: UseWelcomeTestProps) {
  const [state, setState] = useState<WelcomeTestState>({
    testId: null,
    studentId: null,
    teacherId: null,
    title: 'Welcome Test',
    loading: true,
    error: null,
    answers: {},
    currentSectionIndex: 0,
    currentQuestionIndex: 0,
    completed: false,
    submitting: false,
    paused: false,
    persistedAnsweredCount: null,
    isTeacherMode: false,
    studentNativeLanguage: null,
    bank: 1,
    form: 'A',
  });

  // Latest values for callbacks that outlive a render (debounced saves, page-hide
  // handlers, speaking uploads) so they never act on a stale closure.
  const ctxRef = useRef({ testId: null as string | null, studentId: null as string | null, teacherId: null as string | null, isTeacherMode: false });
  ctxRef.current = { testId: state.testId, studentId: state.studentId, teacherId: state.teacherId, isTeacherMode: state.isTeacherMode };
  const answersRef = useRef<Record<string, unknown>>({});
  const shareTokenRef = useRef<string | null>(shareToken);
  shareTokenRef.current = shareToken;
  const completingRef = useRef(false);
  const commitRef = useRef<(questionId: string, answer: unknown, opts?: { isIdk?: boolean }) => Promise<boolean>>(async () => true);
  const [saveSnapshot, setSaveSnapshot] = useState<SaveSnapshot>({ state: 'saved', unsaved: 0, hardFailed: false });
  const [textPending, setTextPending] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const pendingSaves = useRef(createPendingSaves(TEXT_AUTOSAVE_DEBOUNCE_MS));
  const queueRef = useRef<AnswerSaveQueue<SavePayload> | null>(null);
  if (!queueRef.current) {
    queueRef.current = createAnswerSaveQueue<SavePayload>({
      // false from the RPC = not saved (token rotated/expired, test closed): a hard failure.
      save: async (_key, p) => {
        const { data, error } = await supabase.rpc('save_test_answer_by_share_token', {
          p_share_token: shareTokenRef.current as string,
          p_question_index: p.questionIndex,
          p_answer: p.answer as Json,
          p_is_correct: p.isCorrect,
          p_time_spent_seconds: p.timeSpent,
        });
        if (error) throw error;
        return data !== false;
      },
      onChange: setSaveSnapshot,
    });
  }

  const questionTimers = useRef<Record<string, number>>({});
  const detectedTraits = useRef<Record<string, string>>({});
  const committedSections = useRef<Set<string>>(new Set());
  // Answer and skip events: first attempt awaited, up to 2 background retries (1 s, 3 s).
  const eventLogger = useRef(createEventLogger<Record<string, unknown>>({
    call: (args) => (supabase.rpc as any)('log_welcome_test_event_by_share_token', args),
    onGiveUp: (key, message) => devWarn('[useWelcomeTest] answer event not logged:', key, message),
  }));
  
  // PROBLEM 5: Visibility change timer - pause when tab is inactive
  const pausedAtRef = useRef<number | null>(null);
  const accumulatedPauseRef = useRef(0);
  
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        pausedAtRef.current = Date.now();
      } else if (pausedAtRef.current) {
        accumulatedPauseRef.current += (Date.now() - pausedAtRef.current);
        pausedAtRef.current = null;
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // Load test by share token
  useEffect(() => {
    if (!shareToken) {
      setState(prev => ({ ...prev, loading: false, error: 'No test token provided' }));
      return;
    }

    const fetchTest = async () => {
      try {
        // Check if current user is a teacher
        const { data: { user } } = await supabase.auth.getUser();
        const isTeacher = !!user;

        const { data, error } = await supabase
          .rpc('get_test_by_share_token', { p_share_token: shareToken });

        if (error) throw error;
        if (!data || data.length === 0) {
          setState(prev => ({ ...prev, loading: false, error: 'Test not found or expired' }));
          return;
        }

        const testInfo = data[0];

        // Token-scoped context (RLS-safe: requires the exact share token)
        const { data: contextRows, error: contextError } = await supabase
          .rpc('get_test_context_by_share_token', { p_share_token: shareToken });
        if (contextError) devWarn('[useWelcomeTest] context load failed:', contextError.message);
        const fullTest = contextRows?.[0] ?? null;

        const studentId = fullTest?.student_id || null;
        const teacherId = fullTest?.teacher_id || null;
        const nativeLang: string | null = fullTest?.student_native_language || null;

        // Load existing answers (token-scoped)
        const { data: questionsData, error: questionsError } = await supabase
          .rpc('get_test_questions_by_share_token', { p_share_token: shareToken });
        // Failing to load saved answers must not look like an empty test: the
        // student would re-answer and overwrite real progress.
        if (questionsError) throw questionsError;

        // Bank and form: recorded in generation_params; a test without them is bank 1, form A.
        // The seeded row count wins when it names a bank (tests seeded before the fields existed).
        const params = readWelcomeTestParams(fullTest?.generation_params);
        const bank = (questionsData ? bankOfRowCount(questionsData.length) : null) ?? params.welcome_bank;
        const form = params.welcome_form;

        const existingAnswers: Record<string, unknown> = {};
        let dbAnsweredCount = 0;
        if (questionsData) {
          for (const q of questionsData) {
            if (q.student_answer !== null) {
              const id = storedQuestionId(q) ?? ALL_WELCOME_TEST_QUESTIONS[q.question_index]?.id;
              if (id) {
                existingAnswers[id] = q.student_answer;
                dbAnsweredCount++;
              }
            }
          }
        }

        // No version selection - always full test
        const isCompleted = testInfo.status === 'completed' || testInfo.status === 'reviewed';
        const hasExistingAnswers = Object.keys(existingAnswers).length > 0;

        // Update status to in_progress if assigned (only if not teacher)
        if (testInfo.status === 'assigned' && !isTeacher) {
          const { error: startError } = await supabase.rpc('start_test_by_share_token', { p_share_token: shareToken });
          if (startError) devWarn('[useWelcomeTest] start_test failed:', startError.message);
        }

        // For cross-device resume: find first unanswered question
        let restoredSectionIndex = 0;
        let restoredQuestionIndex = 0;
        
        if (hasExistingAnswers && !isCompleted) {
          const visibleSections = sectionsFor(bank, form, existingAnswers);
          let found = false;
          for (let si = 0; si < visibleSections.length && !found; si++) {
            for (let qi = 0; qi < visibleSections[si].questions.length && !found; qi++) {
              if (existingAnswers[visibleSections[si].questions[qi].id] === undefined) {
                restoredSectionIndex = si;
                restoredQuestionIndex = qi;
                found = true;
              }
            }
          }
          if (!found) {
            const lastSection = visibleSections.length - 1;
            restoredSectionIndex = lastSection;
            restoredQuestionIndex = visibleSections[lastSection].questions.length - 1;
          }
        }

        const shouldPause = !isCompleted && hasExistingAnswers && !isTeacher;
        const persistedCount = (testInfo as any).answered_count || dbAnsweredCount || null;

        answersRef.current = existingAnswers;
        setState(prev => ({
          ...prev,
          testId: testInfo.id,
          studentId,
          teacherId,
          title: testInfo.title || 'Welcome Test',
          answers: existingAnswers,
          loading: false,
          completed: isCompleted,
          currentSectionIndex: restoredSectionIndex,
          currentQuestionIndex: restoredQuestionIndex,
          persistedAnsweredCount: persistedCount,
          paused: shouldPause || false,
          isTeacherMode: isTeacher,
          studentNativeLanguage: nativeLang,
          bank,
          form,
        }));
      } catch (err) {
        devWarn('[useWelcomeTest] Error loading welcome test:', err);
        setState(prev => ({ ...prev, loading: false, error: 'Failed to load test' }));
      }
    };

    fetchTest();
  }, [shareToken]);

  // The sections follow the answers: adaptive blocks (bank 2) appear once decided.
  const sections = useMemo(
    () => sectionsFor(state.bank, state.form, state.answers),
    [state.bank, state.form, state.answers],
  );
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  // Definitions of this test's form by id (Form B has its own content and keys).
  const defsById = useMemo(() => new Map(questionDefsFor(state.bank, state.form).map(q => [q.id, q])), [state.bank, state.form]);
  const defsByIdRef = useRef(defsById);
  defsByIdRef.current = defsById;
  const indexOfId = (id: string) => ALL_WELCOME_TEST_QUESTIONS.findIndex(q => q.id === id);

  const allVisibleQuestions = useMemo(() => sections.flatMap(s => s.questions), [sections]);
  const currentSection = sections[state.currentSectionIndex];
  const currentQuestion = currentSection?.questions[state.currentQuestionIndex] || null;

  // Keep the position on the same question when the visible list changes (a block
  // appears or is withdrawn after an earlier answer is edited). Runs only when the
  // sections change: navigation moves the anchor (second effect), it must not be undone.
  const anchorIdRef = useRef<string | null>(null);
  const currentIdRef = useRef<string | null>(null);
  currentIdRef.current = currentQuestion?.id ?? null;
  useEffect(() => {
    const anchorId = anchorIdRef.current;
    if (!anchorId || currentIdRef.current === anchorId) return;
    for (let si = 0; si < sections.length; si++) {
      const qi = sections[si].questions.findIndex(q => q.id === anchorId);
      if (qi >= 0) {
        setState(prev => ({ ...prev, currentSectionIndex: si, currentQuestionIndex: qi }));
        return;
      }
    }
    // The anchored question was withdrawn: stay in the section, on its last question.
    setState(prev => {
      const si = Math.min(prev.currentSectionIndex, sections.length - 1);
      return { ...prev, currentSectionIndex: si, currentQuestionIndex: Math.min(prev.currentQuestionIndex, Math.max(0, sections[si].questions.length - 1)) };
    });
  }, [sections]);
  useEffect(() => {
    if (currentQuestion) anchorIdRef.current = currentQuestion.id;
  }, [currentQuestion?.id]);

  // Start timer for current question
  useEffect(() => {
    if (currentQuestion) {
      questionTimers.current[currentQuestion.id] = Date.now();
    }
  }, [currentQuestion?.id]);

  // Persist position on navigation (localStorage only - fast)
  useEffect(() => {
    if (shareToken && !state.completed) {
      localStorage.setItem(`wt_position_${shareToken}`, JSON.stringify({
        sectionIndex: state.currentSectionIndex,
        questionIndex: state.currentQuestionIndex,
      }));
    }
  }, [state.currentSectionIndex, state.currentQuestionIndex, shareToken, state.completed]);

  // Commit answer to DB + log event. Text answers arrive here from the debounce,
  // blur, navigation or page-hide flush; radio/checkbox/matrix commit immediately.
  // The DB write goes through the per-question save queue (retry + hard-failure
  // detection); the DSLM event is logged only after the save is confirmed.
  // v6.9.67: opts.isIdk flags the event_payload so analytics can distinguish
  // an honest "I don't know" from a wrong guess.
  const commitAnswer = useCallback(async (
    questionId: string,
    answer: unknown,
    opts: { isIdk?: boolean } = {},
  ): Promise<boolean> => {
    const ctx = ctxRef.current;
    if (!ctx.testId || ctx.isTeacherMode) return true;

    const questionDef = defsByIdRef.current.get(questionId);
    if (!questionDef) return true;

    const questionIndex = indexOfId(questionId);
    // PROBLEM 5: Subtract paused time from total time
    const rawTime = questionTimers.current[questionId]
      ? Date.now() - questionTimers.current[questionId]
      : 0;
    const pauseTime = accumulatedPauseRef.current;
    accumulatedPauseRef.current = 0; // Reset for next question
    const timeSpent = Math.max(0, Math.round((rawTime - pauseTime) / 1000));

    // D6: typed (fill_blank) answers use matchAnswer; `review` is null (unscored).
    const isCorrect = checkWelcomeTestKeyedAnswer(questionDef, answer);

    // Detect traits - handle both single-select (string) and multi-select (array)
    if (questionDef.detected_trait) {
      if (Array.isArray(answer)) {
        // FIX 2.3: Multi-select detected_trait mapping
        const traitValues = (answer as string[]).map(a => {
          const idx = questionDef.options?.indexOf(a);
          if (idx !== undefined && idx >= 0) {
            return questionDef.detected_trait!.mapping[String(idx)];
          }
          return null;
        }).filter(Boolean);
        if (traitValues.length > 0) {
          detectedTraits.current[questionDef.detected_trait.trait_name] = traitValues.join(', ');
        }
      } else if (typeof answer === 'string') {
        const optionIndex = questionDef.options?.indexOf(answer);
        if (optionIndex !== undefined && optionIndex >= 0) {
          const traitValue = questionDef.detected_trait.mapping[String(optionIndex)];
          if (traitValue) {
            detectedTraits.current[questionDef.detected_trait.trait_name] = traitValue;
          }
        }
      }
    }

    const { studentId, teacherId } = ctx;
    const onSaved = async () => {
      if (!studentId || !teacherId) return;
      // Payload built by the shared builder (also used by the server to
      // reconcile events lost here). Dedup + insert happen server-side in
      // log_welcome_test_event_by_share_token (anonymous students may not
      // call add_student_event or touch student_events).
      const draft = buildAnswerEvent(toEventQuestion(questionDef), {
        questionIndex,
        answer,
        isCorrect,
        timeSpentSeconds: timeSpent,
        isIdk: opts.isIdk === true,
      });
      await eventLogger.current.log(draft.answer_id, {
        p_share_token: shareTokenRef.current as string,
        p_event_type: 'test_answer_submitted',
        p_answer_id: draft.answer_id,
        p_legacy_answer_id: draft.legacy_answer_id,
        p_element_type: draft.element_type,
        p_event_payload: draft.event_payload as unknown as Json,
        p_skill_ids: draft.skill_ids,
      });
    };

    return queueRef.current!.enqueue(
      questionId,
      { questionIndex, answer, isCorrect, timeSpent },
      { onSaved },
    );
  }, []);
  commitRef.current = commitAnswer;

  // Save answer - updates local state; text answers autosave after a short pause
  // (and on blur, navigation, page hide and unmount), other types commit at once.
  const saveAnswer = useCallback((questionId: string, answer: unknown) => {
    answersRef.current = { ...answersRef.current, [questionId]: answer };
    setState(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer },
    }));

    const questionDef = defsByIdRef.current.get(questionId);
    if (!questionDef) return;

    if (TEXT_INPUT_TYPES.has(questionDef.question_type)) {
      const questionIndex = indexOfId(questionId);
      pendingSaves.current.schedule(questionIndex, () => {
        void commitRef.current(questionId, answer);
        setTextPending(pendingSaves.current.size() > 0);
      });
      setTextPending(true);
      return;
    }

    void commitRef.current(questionId, answer);
  }, []);

  // Flush debounced text answers into the save queue (navigation, blur, page hide).
  const flushPendingAnswer = useCallback(async () => {
    await pendingSaves.current.flush();
    setTextPending(false);
  }, []);

  // Save "I don't know" answer
  const saveIdontKnow = useCallback((questionId: string) => {
    if (defsByIdRef.current.has(questionId)) pendingSaves.current.cancel(indexOfId(questionId));
    answersRef.current = { ...answersRef.current, [questionId]: '__IDK__' };
    setState(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: '__IDK__' },
    }));
    setTextPending(pendingSaves.current.size() > 0);
    void commitRef.current(questionId, '__IDK__', { isIdk: true });
  }, []);

  // Stop an active recording, wait for its final blob and upload it once (the
  // recorder saves the URL through saveAnswer). Resolves false when a recording
  // could not be saved: navigation then stays on the question so the audio is
  // not lost, and the recorder shows why.
  const flushSpeakingIfNeeded = useCallback(async (): Promise<boolean> => flushSpeaking(), []);

  // Retry every failed save (manual button or the browser coming back online).
  const retrySaves = useCallback(async () => {
    await pendingSaves.current.flush();
    return queueRef.current!.retryFailed();
  }, []);

  // Autosave safety net: flush on tab hide / page hide / unmount, retry on reconnect.
  useEffect(() => {
    const flushNow = () => { void pendingSaves.current.flush(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushNow(); };
    const onOnline = () => { void queueRef.current?.retryFailed(); };
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      flushNow();
    };
  }, []);

  // Navigation
  const goToNext = useCallback(async () => {
    if (!(await flushSpeakingIfNeeded())) return;
    await flushPendingAnswer();
    setState(prev => {
      const sections = sectionsRef.current;
      const section = sections[prev.currentSectionIndex];
      if (!section) return prev;
      if (prev.currentQuestionIndex < section.questions.length - 1) {
        return { ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1 };
      } else if (prev.currentSectionIndex < sections.length - 1) {
        return { ...prev, currentSectionIndex: prev.currentSectionIndex + 1, currentQuestionIndex: 0 };
      }
      return prev;
    });
  }, [flushPendingAnswer, flushSpeakingIfNeeded]);

  // Skip question. An already answered question just navigates (never overwrite
  // a real answer with null). Only an unanswered one logs a lightweight
  // test_answer_skipped event so teachers can see which questions the student
  // avoided, without polluting skill scoring: process-welcome-test ignores
  // unknown event types.
  const skipQuestion = useCallback(async () => {
    if (!(await flushSpeakingIfNeeded())) return;
    await flushPendingAnswer();

    const section = sectionsRef.current[state.currentSectionIndex];
    const questionDef = section?.questions[state.currentQuestionIndex];
    const alreadyAnswered = !!questionDef && answersRef.current[questionDef.id] !== undefined;
    if (!alreadyAnswered && state.testId && questionDef && state.studentId && state.teacherId && !state.isTeacherMode) {
      const questionIndex = indexOfId(questionDef.id);
      const draft = buildSkipEvent(toEventQuestion(questionDef), questionIndex);
      void queueRef.current!.enqueue(
        questionDef.id,
        { questionIndex, answer: null, isCorrect: null, timeSpent: null },
        {
          onSaved: () => eventLogger.current.log(draft.answer_id, {
            p_share_token: shareTokenRef.current as string,
            p_event_type: 'test_answer_skipped',
            p_answer_id: draft.answer_id,
            p_legacy_answer_id: draft.legacy_answer_id,
            p_element_type: draft.element_type,
            p_event_payload: draft.event_payload as unknown as Json,
            p_skill_ids: draft.skill_ids,
          }),
        },
      );
    }

    await goToNext();
  }, [flushPendingAnswer, flushSpeakingIfNeeded, goToNext, state.currentSectionIndex, state.currentQuestionIndex, state.testId, state.studentId, state.teacherId, state.isTeacherMode]);

  const goToPrevious = useCallback(async () => {
    if (!(await flushSpeakingIfNeeded())) return;
    await flushPendingAnswer();
    setState(prev => {
      if (prev.currentQuestionIndex > 0) {
        return { ...prev, currentQuestionIndex: prev.currentQuestionIndex - 1 };
      } else if (prev.currentSectionIndex > 0) {
        const prevSection = sectionsRef.current[prev.currentSectionIndex - 1];
        return { ...prev, currentSectionIndex: prev.currentSectionIndex - 1, currentQuestionIndex: prevSection.questions.length - 1 };
      }
      return prev;
    });
  }, [flushPendingAnswer, flushSpeakingIfNeeded]);

  const goToSection = useCallback(async (sectionIndex: number) => {
    if (!(await flushSpeakingIfNeeded())) return;
    await flushPendingAnswer();
    setState(prev => ({ ...prev, currentSectionIndex: sectionIndex, currentQuestionIndex: 0 }));
  }, [flushPendingAnswer, flushSpeakingIfNeeded]);

  const goToQuestionInSection = useCallback(async (sectionIndex: number, questionIndex: number) => {
    if (!(await flushSpeakingIfNeeded())) return;
    await flushPendingAnswer();
    setState(prev => ({ ...prev, currentSectionIndex: sectionIndex, currentQuestionIndex: questionIndex }));
  }, [flushPendingAnswer, flushSpeakingIfNeeded]);

  // Pause test
  const pauseTest = useCallback(() => {
    void flushSpeakingIfNeeded();
    void flushPendingAnswer();
    setState(prev => ({ ...prev, paused: true }));
    toast.success('Test paused. Your progress is saved. Come back anytime!');
  }, [flushPendingAnswer, flushSpeakingIfNeeded]);

  const resumeTest = useCallback(() => {
    setState(prev => ({ ...prev, paused: false }));
  }, []);

  // Complete test. Shows the completed screen only after every answer is
  // confirmed saved and the server accepted the submission; otherwise an error
  // with retry is shown. The server re-grades from the DB and calculates the
  // results itself, so the student client never calls calculate_test_results.
  const completeTest = useCallback(async () => {
    const testId = ctxRef.current.testId;
    if (!testId || completingRef.current) return false;
    completingRef.current = true;
    setCompleteError(null);
    setState(prev => ({ ...prev, submitting: true }));

    const fail = (message: string, detail?: unknown) => {
      devWarn('[useWelcomeTest] completeTest failed:', message, detail);
      setCompleteError(message);
      toast.error(message);
      setState(prev => ({ ...prev, submitting: false }));
      return false;
    };

    try {
      const speakingOk = await flushSpeakingIfNeeded();
      if (!speakingOk) return fail('Your recording is not saved yet. Save or re-record it, then try again.');
      await flushPendingAnswer();
      const allSaved = await queueRef.current!.flush();
      if (!allSaved) {
        return fail('Some answers are not saved yet. Check your connection and tap "Retry saving".');
      }

      const answers = answersRef.current;
      const finalAnsweredCount = allVisibleQuestions.filter(q => answers[q.id] !== undefined).length;

      const { error: countError } = await supabase.rpc('set_test_answered_count_by_share_token', {
        p_share_token: shareTokenRef.current as string,
        p_answered_count: finalAnsweredCount,
      });
      if (countError) return fail('Could not submit your test. Please try again.', countError.message);

      const { error: processError } = await supabase.functions.invoke('process-welcome-test', {
        body: {
          test_id: testId,
          student_id: ctxRef.current.studentId,
          teacher_id: ctxRef.current.teacherId,
          // Proves access to this test (process-welcome-test refuses replays without it).
          share_token: shareTokenRef.current,
          answers,
          // v6.9.56: attach integrity snapshot (tab-blur count + recent
          // events) buffered by `useWelcomeTestIntegrity`. Stored on the
          // backend under `raw_answers.__integrity__`.
          integrity: consumeWelcomeTestIntegrity(testId),
          detected_traits: detectedTraits.current,
          answered_count: finalAnsweredCount,
        },
      });
      if (processError) return fail('Could not submit your test. Please try again.', processError.message);

      if (shareTokenRef.current) {
        try { localStorage.removeItem(`wt_position_${shareTokenRef.current}`); } catch { /* storage unavailable */ }
      }

      setState(prev => ({ ...prev, completed: true, submitting: false, persistedAnsweredCount: finalAnsweredCount }));
      toast.success('Welcome Test completed! Your teacher will review the results.');
      return true;
    } catch (err) {
      return fail('Could not submit your test. Please try again.', err instanceof Error ? err.message : err);
    } finally {
      completingRef.current = false;
    }
  }, [flushPendingAnswer, flushSpeakingIfNeeded, allVisibleQuestions]);

  // Progress calculation
  const totalQuestions = allVisibleQuestions.length;
  const answeredCount = allVisibleQuestions.filter(q => state.answers[q.id] !== undefined).length;
  const progress = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const displayAnsweredCount = state.completed
    ? Math.max(answeredCount, state.persistedAnsweredCount || 0)
    : answeredCount;

  const globalQuestionIndex = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < state.currentSectionIndex; i++) {
      idx += sections[i]?.questions.length || 0;
    }
    return idx + state.currentQuestionIndex;
  }, [state.currentSectionIndex, state.currentQuestionIndex, sections]);

  const isLastQuestion = state.currentSectionIndex === sections.length - 1 && 
    currentSection && state.currentQuestionIndex === currentSection.questions.length - 1;

  const canComplete = answeredCount >= totalQuestions * 0.5;

  const estimatedMinutesRemaining = estimateMinutesLeft(sections, state.answers);
  const sectionProgressPercent = sectionProgress(sections, state.answers, state.currentSectionIndex);

  return {
    ...state,
    sections,
    currentSection,
    currentQuestion,
    globalQuestionIndex,
    totalQuestions,
    answeredCount: displayAnsweredCount,
    progress,
    isLastQuestion,
    canComplete,
    estimatedMinutesRemaining,
    sectionProgressPercent,
    saveAnswer,
    saveIdontKnow,
    skipQuestion,
    goToNext,
    goToPrevious,
    goToSection,
    goToQuestionInSection,
    completeTest,
    completeError,
    saveState: (textPending && saveSnapshot.state === 'saved' ? 'saving' : saveSnapshot.state) as SaveState,
    hasUnsavedAnswers: textPending || saveSnapshot.unsaved > 0,
    saveHardFailed: saveSnapshot.hardFailed,
    retrySaves,
    pauseTest,
    resumeTest,
    flushPendingAnswer,
    flushSpeakingIfNeeded,
  };
}
