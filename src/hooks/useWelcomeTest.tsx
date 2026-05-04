/**
 * useWelcomeTest - Hook for Welcome Test session management
 * Handles answer submission, timing, trait detection, pause/resume
 * Round 6: Removed Quick Version, fixed element_type, enriched payload, fixed dedup
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  ALL_WELCOME_TEST_QUESTIONS, 
  WELCOME_TEST_SECTIONS_WITH_QUESTIONS,
} from '@/data/welcomeTestQuestions';
import type { WelcomeTestQuestionDef, WelcomeTestSectionDef } from '@/types/welcomeTest';
import type { Json } from '@/integrations/supabase/types';
import { toCanonicalId } from '@/utils/welcomeTestNumbering';
import { devLog, devWarn } from '@/utils/logger';

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
}

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
  });

  const questionTimers = useRef<Record<string, number>>({});
  const detectedTraits = useRef<Record<string, string>>({});
  const committedSections = useRef<Set<string>>(new Set());
  const pendingCommit = useRef<string | null>(null);
  
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

        const { data: fullTest } = await supabase
          .from('student_tests')
          .select('student_id, teacher_id, generation_params')
          .eq('id', testInfo.id)
          .single();

        const studentId = fullTest?.student_id || null;
        const teacherId = fullTest?.teacher_id || null;

        // Fetch student's native language for auto-translation
        let nativeLang: string | null = null;
        if (studentId) {
          const { data: studentData } = await supabase
            .from('students')
            .select('native_language')
            .eq('id', studentId)
            .single();
          nativeLang = studentData?.native_language || null;
        }

        // Load existing answers
        const { data: questionsData } = await supabase
          .from('student_test_questions')
          .select('*')
          .eq('test_id', testInfo.id)
          .order('question_index', { ascending: true });

        const existingAnswers: Record<string, unknown> = {};
        let dbAnsweredCount = 0;
        if (questionsData) {
          for (const q of questionsData) {
            if (q.student_answer !== null) {
              const questionDef = ALL_WELCOME_TEST_QUESTIONS[q.question_index];
              if (questionDef) {
                existingAnswers[questionDef.id] = q.student_answer;
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
          await supabase
            .from('student_tests')
            .update({ status: 'in_progress', started_at: new Date().toISOString() })
            .eq('id', testInfo.id);
        }

        // For cross-device resume: find first unanswered question
        let restoredSectionIndex = 0;
        let restoredQuestionIndex = 0;
        
        if (hasExistingAnswers && !isCompleted) {
          const visibleSections = WELCOME_TEST_SECTIONS_WITH_QUESTIONS;
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
        }));
      } catch (err) {
        console.error('Error loading welcome test:', err);
        setState(prev => ({ ...prev, loading: false, error: 'Failed to load test' }));
      }
    };

    fetchTest();
  }, [shareToken]);

  // Always full test - no version filtering
  const sections = WELCOME_TEST_SECTIONS_WITH_QUESTIONS;

  const allVisibleQuestions = useMemo(() => sections.flatMap(s => s.questions), [sections]);
  const currentSection = sections[state.currentSectionIndex];
  const currentQuestion = currentSection?.questions[state.currentQuestionIndex] || null;

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

  // commitAnswer with fixed element_type, enriched payload, and fixed dedup

  // Commit answer to DB + log event (called on blur/navigate for text, immediately for radio/checkbox)
  const commitAnswer = useCallback(async (questionId: string, answer: unknown) => {
    if (!state.testId || state.isTeacherMode) return;

    const questionDef = ALL_WELCOME_TEST_QUESTIONS.find(q => q.id === questionId);
    if (!questionDef) return;

    const questionIndex = ALL_WELCOME_TEST_QUESTIONS.indexOf(questionDef);
    // PROBLEM 5: Subtract paused time from total time
    const rawTime = questionTimers.current[questionId]
      ? Date.now() - questionTimers.current[questionId]
      : 0;
    const pauseTime = accumulatedPauseRef.current;
    accumulatedPauseRef.current = 0; // Reset for next question
    const timeSpent = Math.max(0, Math.round((rawTime - pauseTime) / 1000));

    let isCorrect: boolean | null = null;
    if (questionDef.correct_answer) {
      if (Array.isArray(questionDef.correct_answer)) {
        const answerStr = String(answer).toLowerCase().trim();
        isCorrect = questionDef.correct_answer.some(
          ca => ca.toLowerCase().trim() === answerStr
        );
      } else {
        isCorrect = String(answer).toLowerCase().trim() === 
                    String(questionDef.correct_answer).toLowerCase().trim();
      }
    }

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

    try {
      await supabase
        .from('student_test_questions')
        .update({
          student_answer: answer as Json,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
          time_spent_seconds: timeSpent,
        })
        .eq('test_id', state.testId)
        .eq('question_index', questionIndex);

      // Log test_answer_submitted event with nano_skill_ratings
      if (state.studentId && state.teacherId) {
        const nanoSkillRatings = questionDef.nano_skill ? [{
          name: questionDef.nano_skill,
          reason: questionDef.scoring_logic || questionDef.description || '',
          mastery: isCorrect === true ? 100 : isCorrect === false ? 0 : -1,
          hasValue: isCorrect !== null,
          question_index: 0,
        }] : [];

        // DELETE previous event for this question (dedup).
        // We delete by both canonical and legacy answer_id to cover
        // pre-renumber events that may still reference the legacy ID.
        const canonicalId = toCanonicalId(questionId);
        await supabase
          .from('student_events')
          .delete()
          .eq('student_id', state.studentId)
          .eq('source_id', state.testId)
          .eq('event_type', 'test_answer_submitted')
          .filter('event_payload->>answer_id', 'eq', canonicalId);
        if (canonicalId !== questionId) {
          await supabase
            .from('student_events')
            .delete()
            .eq('student_id', state.studentId)
            .eq('source_id', state.testId)
            .eq('event_type', 'test_answer_submitted')
            .filter('event_payload->>answer_id', 'eq', questionId);
        }

        // Detect trait value for profiling questions - handle multi-select
        let detectedTraitData: Record<string, string> | undefined;
        if (questionDef.detected_trait) {
          if (Array.isArray(answer)) {
            // FIX 2.3: Multi-select detected_trait mapping for event payload
            const traitValues = (answer as string[]).map(a => {
              const idx = questionDef.options?.indexOf(a);
              if (idx !== undefined && idx >= 0) {
                return questionDef.detected_trait!.mapping[String(idx)];
              }
              return null;
            }).filter(Boolean);
            if (traitValues.length > 0) {
              detectedTraitData = { [questionDef.detected_trait.trait_name]: traitValues.join(', ') };
            }
          } else if (typeof answer === 'string') {
            const optionIndex = questionDef.options?.indexOf(answer);
            if (optionIndex !== undefined && optionIndex >= 0) {
              const traitValue = questionDef.detected_trait.mapping[String(optionIndex)];
              if (traitValue) {
                detectedTraitData = { [questionDef.detected_trait.trait_name]: traitValue };
              }
            }
          }
        }

        // Fallback: for profiling questions without detected_trait, save answer value
        // Round 8: Use semantic trait keys instead of generic 'answer_value'
        const QUESTION_TRAIT_FALLBACK: Record<string, string> = {
          'wt_q2': 'main_frustrations',
          'wt_q3b': 'usage_context',
          'wt_q6': 'preferred_activities',
          'wt_q9': 'learning_duration',
          'wt_q10': 'learning_background',
          'wt_q11': 'exam_experience',
          'wt_q12': 'learning_goal',
          'wt_q13': 'desired_topics',
          
          'wt_q41': 'learning_priorities',
          'wt_q43': 'interest_topics',
          'wt_q45': 'final_message',
        };

        if (!detectedTraitData && !questionDef.correct_answer && !questionDef.nano_skill) {
          if (questionDef.question_type === 'self_assessment_matrix' && typeof answer === 'object') {
            detectedTraitData = { confidence_matrix: JSON.stringify(answer) };
          } else if (questionDef.question_type === 'preference_choice' && Array.isArray(answer)) {
            const traitKey = QUESTION_TRAIT_FALLBACK[questionId] || 'selected_preferences';
            detectedTraitData = { [traitKey]: (answer as string[]).join('; ') };
          } else if (answer !== undefined && answer !== null && answer !== '__IDK__') {
            const traitKey = QUESTION_TRAIT_FALLBACK[questionId] || 'answer_value';
            detectedTraitData = { [traitKey]: typeof answer === 'string' ? answer : JSON.stringify(answer) };
          }
        }

        await supabase.rpc('add_student_event', {
          p_student_id: state.studentId,
          p_teacher_id: state.teacherId,
          p_event_type: 'test_answer_submitted',
          p_event_source: 'welcome_test',
          p_source_id: state.testId,
          p_element_type: questionDef.element_type || questionDef.question_type || null,
          p_event_payload: {
            answer_id: canonicalId,
            legacy_answer_id: questionId,
            exercise_type: questionDef.question_type,
            exercise_index: questionIndex,
            is_correct: isCorrect,
            nano_skill_ratings: nanoSkillRatings,
            detected_traits: detectedTraitData,
            time_spent_seconds: timeSpent,
          } as unknown as Json,
          p_skill_ids: questionDef.nano_skill ? [questionDef.nano_skill] : [],
        });
      }
    } catch (err) {
      console.error('Error committing answer:', err);
    }
  }, [state.testId, state.studentId, state.teacherId, state.answers, state.isTeacherMode]);

  // Save answer - updates local state, commits immediately for non-text questions
  const saveAnswer = useCallback(async (questionId: string, answer: unknown) => {
    setState(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: answer },
    }));

    const questionDef = ALL_WELCOME_TEST_QUESTIONS.find(q => q.id === questionId);
    if (!questionDef) return;

    // For text inputs, defer commit to blur/navigation
    if (TEXT_INPUT_TYPES.has(questionDef.question_type)) {
      pendingCommit.current = questionId;
      return;
    }

    // For radio/checkbox/matrix, commit immediately
    await commitAnswer(questionId, answer);
  }, [commitAnswer]);

  // Flush pending text answer (called on navigation)
  const flushPendingAnswer = useCallback(async () => {
    if (pendingCommit.current && state.answers[pendingCommit.current] !== undefined) {
      await commitAnswer(pendingCommit.current, state.answers[pendingCommit.current]);
      pendingCommit.current = null;
    }
  }, [commitAnswer, state.answers]);

  // Save "I don't know" answer
  const saveIdontKnow = useCallback((questionId: string) => {
    setState(prev => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: '__IDK__' },
    }));
    commitAnswer(questionId, '__IDK__');
  }, [commitAnswer]);

  // Flush pending speaking recording before navigation (synchronous approach)
  // Round 8: Uses uploadBlobToR2 (base64 JSON) instead of FormData
  const flushSpeakingIfNeeded = useCallback(async () => {
    const pending = (window as any).__pendingSpeakingRecording;
    if (!pending?.blob || !pending?.questionId) return;
    
    delete (window as any).__pendingSpeakingRecording;
    
    try {
      const { uploadBlobToR2 } = await import('@/components/welcome-test/SpeakingRecorder');
      
      devLog('[flushSpeaking] Uploading pending recording for:', pending.questionId);
      const url = await uploadBlobToR2(pending.blob);
      if (url) {
        devLog('[flushSpeaking] Upload success, saving answer:', url);
        await saveAnswer(pending.questionId, url);
        await commitAnswer(pending.questionId, url);
      } else {
        devWarn('[flushSpeaking] Upload returned no URL, saving placeholder');
        await saveAnswer(pending.questionId, `recording_pending_${Date.now()}`);
        await commitAnswer(pending.questionId, `recording_pending_${Date.now()}`);
      }
    } catch (err) {
      console.error('[flushSpeaking] Upload failed:', err);
      const placeholder = `recording_pending_${Date.now()}`;
      await saveAnswer(pending.questionId, placeholder);
      await commitAnswer(pending.questionId, placeholder);
    }
  }, [saveAnswer, commitAnswer]);

  // Navigation
  const goToNext = useCallback(async () => {
    await flushSpeakingIfNeeded();
    await flushPendingAnswer();
    setState(prev => {
      const section = sections[prev.currentSectionIndex];
      if (!section) return prev;
      if (prev.currentQuestionIndex < section.questions.length - 1) {
        return { ...prev, currentQuestionIndex: prev.currentQuestionIndex + 1 };
      } else if (prev.currentSectionIndex < sections.length - 1) {
        return { ...prev, currentSectionIndex: prev.currentSectionIndex + 1, currentQuestionIndex: 0 };
      }
      return prev;
    });
  }, [sections, flushPendingAnswer, flushSpeakingIfNeeded]);

  // Skip question (just move forward without saving)
  const skipQuestion = useCallback(async () => {
    await flushSpeakingIfNeeded();
    await flushPendingAnswer();
    await goToNext();
  }, [flushPendingAnswer, flushSpeakingIfNeeded, goToNext]);

  const goToPrevious = useCallback(async () => {
    await flushSpeakingIfNeeded();
    await flushPendingAnswer();
    setState(prev => {
      if (prev.currentQuestionIndex > 0) {
        return { ...prev, currentQuestionIndex: prev.currentQuestionIndex - 1 };
      } else if (prev.currentSectionIndex > 0) {
        const prevSection = sections[prev.currentSectionIndex - 1];
        return { ...prev, currentSectionIndex: prev.currentSectionIndex - 1, currentQuestionIndex: prevSection.questions.length - 1 };
      }
      return prev;
    });
  }, [sections, flushPendingAnswer, flushSpeakingIfNeeded]);

  const goToSection = useCallback((sectionIndex: number) => {
    flushPendingAnswer();
    setState(prev => ({ ...prev, currentSectionIndex: sectionIndex, currentQuestionIndex: 0 }));
  }, [flushPendingAnswer]);

  const goToQuestionInSection = useCallback((sectionIndex: number, questionIndex: number) => {
    flushPendingAnswer();
    setState(prev => ({ ...prev, currentSectionIndex: sectionIndex, currentQuestionIndex: questionIndex }));
  }, [flushPendingAnswer]);

  // Pause test
  const pauseTest = useCallback(() => {
    flushPendingAnswer();
    setState(prev => ({ ...prev, paused: true }));
    toast.success('Test paused. Your progress is saved. Come back anytime!');
  }, [flushPendingAnswer]);

  const resumeTest = useCallback(() => {
    setState(prev => ({ ...prev, paused: false }));
  }, []);

  // Complete test
  const completeTest = useCallback(async () => {
    if (!state.testId) return false;

    await flushPendingAnswer();
    setState(prev => ({ ...prev, submitting: true }));

    try {
      await supabase.rpc('calculate_test_results', { p_test_id: state.testId });

      const finalAnsweredCount = allVisibleQuestions.filter(q => state.answers[q.id] !== undefined).length;
      
      await supabase
        .from('student_tests')
        .update({ answered_count: finalAnsweredCount })
        .eq('id', state.testId);

      await supabase.functions.invoke('process-welcome-test', {
        body: {
          test_id: state.testId,
          student_id: state.studentId,
          teacher_id: state.teacherId,
          answers: state.answers,
          detected_traits: detectedTraits.current,
          answered_count: finalAnsweredCount,
        },
      });

      if (shareToken) {
        localStorage.removeItem(`wt_position_${shareToken}`);
      }

      setState(prev => ({ ...prev, completed: true, submitting: false, persistedAnsweredCount: finalAnsweredCount }));
      toast.success('Welcome Test completed! Your teacher will review the results.');
      return true;
    } catch (err) {
      console.error('Error completing welcome test:', err);
      toast.error('Failed to complete test');
      setState(prev => ({ ...prev, submitting: false }));
      return false;
    }
  }, [state.testId, state.studentId, state.teacherId, state.answers, shareToken, flushPendingAnswer, allVisibleQuestions]);

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

  const estimatedMinutesRemaining = Math.max(1, Math.ceil((totalQuestions - answeredCount) * 40 / 60));

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
    saveAnswer,
    saveIdontKnow,
    skipQuestion,
    goToNext,
    goToPrevious,
    goToSection,
    goToQuestionInSection,
    completeTest,
    pauseTest,
    resumeTest,
    flushPendingAnswer,
    flushSpeakingIfNeeded,
  };
}
