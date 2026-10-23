import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  ExerciseAnswers,
  HomeworkProgress 
} from '@/types/interactiveHomework';
import { AiEvaluation } from '@/components/homework/AiEvaluationBadge';
import { ItemEvaluation, OPEN_ENDED_EXERCISE_TYPES } from '@/utils/masteryCalculator';
import { devLog, devWarn } from '@/utils/logger';
import { createPendingSaves } from '@/lib/answers/pendingSaves';
import { questionIndicesOf, hasAnswerForQuestion } from '@/lib/answers/answerKeys';
import { callStudentAnswerRpc, submitHomeworkAnswers } from '@/lib/answers/studentAnswerRpc';
import { invokeWithRetry } from '@/lib/answers/invokeWithRetry';
import { buildHomeworkDelta, parseAiEvaluations } from '@/lib/homework/deltaSave';


interface UseInteractiveHomeworkProps {
  homeworkId: string;
  sourceWorksheetId?: string;
  studentEmail: string;
  totalExercises: number;
  exerciseQuestionCounts?: Record<number, number>;
  exercises?: any[];
  /** v6.9.84: required for anonymous students: direct table writes were
   *  replaced by the token-scoped RPC `update_homework_answer_by_share_token`. */
  shareToken?: string;
  /** Teacher "View as student": the page is shown but nothing is ever written for the student. */
  readOnly?: boolean;
}

export const useInteractiveHomework = ({
  homeworkId,
  sourceWorksheetId,
  studentEmail,
  totalExercises,
  exerciseQuestionCounts = {},
  exercises = [],
  shareToken,
  readOnly = false
}: UseInteractiveHomeworkProps) => {
  const [answers, setAnswers] = useState<Record<number, ExerciseAnswers>>({});
  // submitHomework is memoised without `answers` in its deps; it reads the latest
  // answers through this ref so a submit in the same session never sees a stale copy.
  const answersRef = useRef<Record<number, ExerciseAnswers>>(answers);
  answersRef.current = answers;
  const [audioAnswers, setAudioAnswers] = useState<Record<number, Record<number, string>>>({});
  const audioAnswersRef = useRef<Record<number, Record<number, string>>>(audioAnswers);
  audioAnswersRef.current = audioAnswers;
  // Answer keys / recordings changed since the last confirmed save, per exercise: a save sends only these.
  const dirtyKeysRef = useRef<Record<number, Set<string>>>({});
  const dirtyAudioRef = useRef<Record<number, Set<number>>>({});
  const submittingRef = useRef(false);
  const [aiEvaluations, setAiEvaluations] = useState<Record<number, Record<number, AiEvaluation>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
  const [isWaitingForAiEval, setIsWaitingForAiEval] = useState(false);
  
  const pendingSavesQueueRef = useRef(createPendingSaves());
  const pendingSavesRef = useRef<Set<number>>(new Set());
  // True while at least one save failed and is waiting for a retry (shown in the progress bar).
  const [saveFailed, setSaveFailed] = useState(false);
  // One error toast per failure streak: the queue retries on its own.
  const saveErrorShownRef = useRef(false);
  useEffect(() => pendingSavesQueueRef.current.onStatus((st) => setSaveFailed(st.failed > 0)), []);
  
  const exerciseStartTimeRef = useRef<Record<number, number>>({});
  const exerciseActiveTimeRef = useRef<Record<number, number>>({});
  const isTabActiveRef = useRef(true);

  const verifyStudentEmail = useCallback(async (homeworkId: string, email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.rpc('verify_homework_student_email', {
        p_homework_id: homeworkId,
        p_email: email
      });

      if (error) {
        console.error('Error verifying student email:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Error verifying student email:', error);
      return false;
    }
  }, []);

  const loadAnswers = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await callStudentAnswerRpc('get_student_homework_answers', {
        p_homework_id: homeworkId,
        p_student_email: studentEmail
      }, shareToken);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedAnswers: Record<number, ExerciseAnswers> = {};
        const loadedAudio: Record<number, Record<number, string>> = {};
        let allSubmitted = true;

        data.forEach((answer: any) => {
          loadedAnswers[answer.exercise_index] = answer.answers;
          
          if (answer.audio_answers && typeof answer.audio_answers === 'object' && Object.keys(answer.audio_answers).length > 0) {
            const audioForExercise: Record<number, string> = {};
            for (const [qIdx, url] of Object.entries(answer.audio_answers)) {
              if (url && typeof url === 'string') {
                audioForExercise[parseInt(qIdx)] = url;
              }
            }
            if (Object.keys(audioForExercise).length > 0) {
              loadedAudio[answer.exercise_index] = audioForExercise;
            }
          }
          
          if (!answer.is_submitted) {
            allSubmitted = false;
          }
          if (answer.submitted_at) {
            setSubmittedAt(new Date(answer.submitted_at));
          }
        });

        setAnswers(loadedAnswers);
        setAiEvaluations(parseAiEvaluations(data));
        setAudioAnswers(loadedAudio);
        setIsSubmitted(allSubmitted);
      }
    } catch (error: any) {
      console.error('Error loading answers:', error);
      toast({
        title: "Error loading your answers",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [homeworkId, studentEmail, shareToken]);

  const getActiveTimeMs = useCallback((exerciseIndex: number): number => {
    const accumulated = exerciseActiveTimeRef.current[exerciseIndex] || 0;
    const startTime = exerciseStartTimeRef.current[exerciseIndex];
    
    if (startTime && isTabActiveRef.current) {
      return accumulated + (Date.now() - startTime);
    }
    return accumulated;
  }, []);

  /** One request: the delta of an exercise (merged by key on the server), never a whole snapshot. */
  const saveAnswer = useCallback(async (
    exerciseIndex: number, 
    exerciseType: string, 
    exerciseAnswers: ExerciseAnswers, 
    mastery?: number | null,
    itemEvaluations?: ItemEvaluation[] | null,
    audioAnswersForExercise?: Record<number, string> | null
  ): Promise<boolean> => {
    try {
      setIsSaving(true);
      
      const activeTimeMs = getActiveTimeMs(exerciseIndex);
      
      const { error } = await callStudentAnswerRpc('save_homework_answer', {
        p_homework_id: homeworkId,
        p_student_email: studentEmail,
        p_exercise_index: exerciseIndex,
        p_exercise_type: exerciseType,
        p_answers: exerciseAnswers as any,
        p_time_spent_ms: activeTimeMs,
        p_mastery: mastery ?? null,
        p_item_evaluations: itemEvaluations ? JSON.parse(JSON.stringify(itemEvaluations)) : null,
        p_audio_answers: audioAnswersForExercise ? JSON.parse(JSON.stringify(audioAnswersForExercise)) : null
      }, shareToken);

      if (error) throw error;

      setLastSavedAt(new Date());
      pendingSavesRef.current.delete(exerciseIndex);
      
      if (pendingSavesRef.current.size === 0) {
        setIsSaving(false);
      }
      saveErrorShownRef.current = false;
      return true;
    } catch (error: any) {
      console.error('Error saving answer:', error);
      if (!saveErrorShownRef.current) {
        saveErrorShownRef.current = true;
        toast({
          title: "Your answer is not saved yet",
          description: "We will keep trying. Please stay on this page.",
          variant: "destructive"
        });
      }
      setIsSaving(false);
      return false; // the queue retries a failed save
    }
  }, [homeworkId, studentEmail, getActiveTimeMs, shareToken]);

  /**
   * Save job of one exercise. It reads the dirty keys and the latest local state when it
   * runs (also on every retry), so a debounced, blurred or retried save always sends the
   * newest value of exactly the keys this tab changed.
   */
  const runSave = useCallback(async (exerciseIndex: number, exerciseType: string): Promise<boolean> => {
    const dirty = dirtyKeysRef.current[exerciseIndex];
    const dirtyAudio = dirtyAudioRef.current[exerciseIndex];
    const delta = buildHomeworkDelta({
      exerciseData: { ...exercises[exerciseIndex], worksheetId: sourceWorksheetId || homeworkId },
      exerciseType,
      answers: (answersRef.current[exerciseIndex] || {}) as Record<string, any>,
      audio: audioAnswersRef.current[exerciseIndex] || {},
      dirtyKeys: dirty ?? [],
      dirtyAudio: dirtyAudio ?? [],
    });
    if (!delta) {
      pendingSavesRef.current.delete(exerciseIndex);
      if (pendingSavesRef.current.size === 0) setIsSaving(false);
      return true;
    }
    devLog('[useInteractiveHomework] Saving delta:', { exerciseIndex, exerciseType, keys: delta.keys, audioKeys: delta.audioKeys });
    const ok = await saveAnswer(exerciseIndex, exerciseType, delta.answers, delta.mastery, delta.itemEvaluations, delta.audio);
    if (ok) {
      // A key edited again while the request was in flight stays dirty for its own save.
      const sentAnswers = answersRef.current[exerciseIndex] as Record<string, any> | undefined;
      for (const k of delta.keys) if (sentAnswers?.[k] === delta.answers[k]) dirty?.delete(k);
      const sentAudio = audioAnswersRef.current[exerciseIndex];
      for (const q of delta.audioKeys) if (sentAudio?.[q] === delta.audio?.[q]) dirtyAudio?.delete(q);
    }
    return ok;
  }, [exercises, sourceWorksheetId, homeworkId, saveAnswer]);

  const updateAnswer = useCallback((
    exerciseIndex: number, 
    exerciseType: string,
    questionIndex: number, 
    value: any
  ) => {
    if (!exerciseStartTimeRef.current[exerciseIndex]) {
      exerciseStartTimeRef.current[exerciseIndex] = Date.now();
    }
    
    setAnswers(prev => ({
      ...prev,
      [exerciseIndex]: {
        ...(prev[exerciseIndex] || {}),
        [questionIndex]: value
      }
    }));
    // The save job reads the ref, which only follows state after the next render.
    answersRef.current = {
      ...answersRef.current,
      [exerciseIndex]: { ...(answersRef.current[exerciseIndex] || {}), [questionIndex]: value }
    };

    if (readOnly || isSubmitted) return;
    (dirtyKeysRef.current[exerciseIndex] ??= new Set()).add(String(questionIndex));
    pendingSavesRef.current.add(exerciseIndex);
    setIsSaving(true);
    pendingSavesQueueRef.current.schedule(exerciseIndex, () => runSave(exerciseIndex, exerciseType));
  }, [runSave, readOnly, isSubmitted]);

  const saveOnBlur = useCallback((exerciseIndex: number, exerciseType: string) => {
    if (readOnly || isSubmitted) return;
    // A blur without edits writes nothing: it must never replay an old local snapshot.
    const dirty = dirtyKeysRef.current[exerciseIndex];
    const dirtyAudio = dirtyAudioRef.current[exerciseIndex];
    if ((!dirty || dirty.size === 0) && (!dirtyAudio || dirtyAudio.size === 0)) return;
    // Save this exercise right now through the queue (serialized and retried); other exercises keep their pending saves.
    const queue = pendingSavesQueueRef.current;
    queue.schedule(exerciseIndex, () => runSave(exerciseIndex, exerciseType), 0);
    void queue.flushOne(exerciseIndex);
  }, [runSave, readOnly, isSubmitted]);

  /**
   * Re-reads the stored evaluations (written by the server after submit) without touching the
   * answers. Returns true once every submitted open exercise with an answer has its evaluation.
   */
  const loadEvaluations = useCallback(async (): Promise<boolean> => {
    const { data, error } = await callStudentAnswerRpc('get_student_homework_answers', {
      p_homework_id: homeworkId,
      p_student_email: studentEmail
    }, shareToken);
    if (error || !data) return false;
    setAiEvaluations(parseAiEvaluations(data));
    return data.every((row: any) => {
      const hasAnswer = row.answers && typeof row.answers === 'object' && Object.keys(row.answers).length > 0;
      return !(row.is_submitted && hasAnswer && OPEN_ENDED_EXERCISE_TYPES.includes(row.exercise_type)) || !!row.ai_evaluation;
    });
  }, [homeworkId, studentEmail, shareToken]);

  const submitHomework = useCallback(async () => {
    if (readOnly || submittingRef.current) return false;
    submittingRef.current = true;
    try {
      setIsSaving(true);

      const pendingMap = (window as any).__pendingSpeakingRecordings as Map<string, { save: () => Promise<void> }> | undefined;
      if (pendingMap && pendingMap.size > 0) {
        devLog(`[submitHomework] Flushing ${pendingMap.size} pending recordings...`);
        await Promise.all(Array.from(pendingMap.values()).map(e => e.save().catch(console.error)));
        await new Promise(r => setTimeout(r, 500));
      }

      // Persist every answer still waiting in the autosave debounce before submitting.
      const allSaved = await pendingSavesQueueRef.current.flush();
      if (!allSaved) {
        // Submitting on top of answers the server never received would grade older data.
        toast({
          title: "Some answers are not saved yet",
          description: "Check your connection and press Submit again in a moment.",
          variant: "destructive"
        });
        setIsSaving(false);
        return false;
      }

      // The server marks the answers submitted, notifies the teacher and records the
      // homework_submitted event in this same call (submit_homework_answers).
      const { error } = await submitHomeworkAnswers(homeworkId, studentEmail, shareToken);

      if (error) throw error;

      setIsSubmitted(true);
      setSubmittedAt(new Date());

      // Grading is server-owned: the browser only asks for it and reads the stored result.
      // A failure here is harmless, the scheduled run evaluates the same rows later.
      setIsWaitingForAiEval(true);
      try {
        const { error: evalError } = await invokeWithRetry<unknown>(() => supabase.functions.invoke('process-pending-ai-evaluations', {
          body: {
            homework_id: homeworkId,
            trigger_source: 'submit_homework',
            share_token: shareToken || '',
            student_email: studentEmail,
          }
        }));
        if (evalError) devWarn('[submitHomework] Immediate evaluation did not run, the scheduled run will grade it:', evalError);
        // A slow or timed-out request keeps grading on the server: look again a few times
        // so the student sees the feedback without reloading (the scheduled run is the fallback).
        let complete = await loadEvaluations();
        for (const waitMs of [5000, 15000, 30000]) {
          if (complete) break;
          await new Promise((r) => setTimeout(r, waitMs));
          complete = await loadEvaluations();
        }
      } catch (aiError) {
        devWarn('[submitHomework] Evaluation request failed (non-blocking):', aiError);
      } finally {
        setIsWaitingForAiEval(false);
      }

      toast({
        title: "Homework submitted!",
        description: "Your teacher has been notified.",
      });

      return true;
    } catch (error: any) {
      console.error('Error submitting homework:', error);
      toast({
        title: "Error submitting homework",
        description: error.message,
        variant: "destructive"
      });
      return false;
    } finally {
      submittingRef.current = false;
      setIsSaving(false);
    }
  }, [homeworkId, studentEmail, shareToken, readOnly, loadEvaluations]);

  const getProgress = useCallback((): HomeworkProgress => {
    let answeredExercises = 0;
    let totalTasks = 0;
    let answeredTasks = 0;
    
    for (let i = 0; i < totalExercises; i++) {
      const questionCount = exerciseQuestionCounts[i] || 1;
      totalTasks += questionCount;
    }
    
    const allExerciseIndices = new Set([
      ...Object.keys(answers).map(Number),
      ...Object.keys(audioAnswers).map(Number)
    ]);
    
    allExerciseIndices.forEach(exerciseIndex => {
      const exerciseAnswers = answers[exerciseIndex] || {};
      const exerciseAudio = audioAnswers[exerciseIndex] || {};
      const questionCount = exerciseQuestionCounts[exerciseIndex] || 1;
      
      // Multi-blank sentences are stored under `${q}_${blank}`: count each sentence once.
      const allQIndices = new Set([
        ...questionIndicesOf(exerciseAnswers as Record<string | number, unknown>),
        ...Object.keys(exerciseAudio).map(Number)
      ]);
      
      let answeredQuestionsCount = 0;
      allQIndices.forEach(qIdx => {
        const hasText = hasAnswerForQuestion(exerciseAnswers as Record<string | number, unknown>, qIdx);
        const hasAudio = !!exerciseAudio[qIdx];
        if (hasText || hasAudio) answeredQuestionsCount++;
      });
      
      answeredTasks += answeredQuestionsCount;
      if (answeredQuestionsCount >= questionCount) answeredExercises++;
    });

    const cappedAnsweredTasks = Math.min(answeredTasks, totalTasks);
    const percentageComplete = totalTasks > 0 
      ? Math.min(100, Math.round((cappedAnsweredTasks / totalTasks) * 100))
      : 0;

    return { totalExercises, answeredExercises, percentageComplete, totalTasks, answeredTasks: cappedAnsweredTasks };
  }, [answers, audioAnswers, totalExercises, exerciseQuestionCounts]);

  useEffect(() => {
    if (homeworkId && studentEmail) {
      loadAnswers();
    }
  }, [homeworkId, studentEmail, loadAnswers]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isTabActiveRef.current = false;
        Object.keys(exerciseStartTimeRef.current).forEach(indexStr => {
          const idx = parseInt(indexStr);
          const startTime = exerciseStartTimeRef.current[idx];
          if (startTime) {
            exerciseActiveTimeRef.current[idx] = (exerciseActiveTimeRef.current[idx] || 0) + (Date.now() - startTime);
            exerciseStartTimeRef.current[idx] = 0;
          }
        });
      } else {
        isTabActiveRef.current = true;
        Object.keys(exerciseActiveTimeRef.current).forEach(indexStr => {
          const idx = parseInt(indexStr);
          exerciseStartTimeRef.current[idx] = Date.now();
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const queue = pendingSavesQueueRef.current;
    return () => {
      // Leaving the page must not drop answers typed in the last second.
      void queue.flush();
    };
  }, []);

  const updateAudioAnswer = useCallback((exerciseIndex: number, questionIndex: number, audioUrl: string) => {
    if (readOnly || isSubmitted) return;

    setAudioAnswers(prev => ({
      ...prev,
      [exerciseIndex]: {
        ...(prev[exerciseIndex] || {}),
        [questionIndex]: audioUrl
      }
    }));
    // The save job reads the ref, which only follows state after the next render.
    audioAnswersRef.current = {
      ...audioAnswersRef.current,
      [exerciseIndex]: { ...(audioAnswersRef.current[exerciseIndex] || {}), [questionIndex]: audioUrl }
    };
    (dirtyAudioRef.current[exerciseIndex] ??= new Set()).add(questionIndex);

    const exerciseType = exercises[exerciseIndex]?.type || exercises[exerciseIndex]?.exercise_type || '';
    const queue = pendingSavesQueueRef.current;
    queue.schedule(exerciseIndex, () => runSave(exerciseIndex, exerciseType), 0);
    void queue.flushOne(exerciseIndex);
    
    devLog('[useInteractiveHomework] Audio answer saved to DB:', { exerciseIndex, questionIndex, audioUrl: audioUrl.substring(0, 50) });
  }, [exercises, runSave, isSubmitted, readOnly]);

  return {
    answers,
    audioAnswers,
    aiEvaluations,
    isLoading,
    isSaving,
    saveFailed,
    lastSavedAt,
    isSubmitted,
    submittedAt,
    isWaitingForAiEval,
    updateAnswer,
    updateAudioAnswer,
    saveOnBlur,
    submitHomework,
    verifyStudentEmail,
    getProgress,
    refetchAnswers: loadAnswers
  };
};
