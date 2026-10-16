// ============================================
// FAZA 2: Interactive Shared Worksheets - Student Hook
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ExerciseAnswers } from '@/types/interactiveHomework';
import { SharedWorksheetProgress } from '@/types/interactiveSharedWorksheet';
import { 
  buildItemEvaluations, 
  calculateOverallMastery,
  OPEN_ENDED_EXERCISE_TYPES,
  isClosedExerciseType,
  ItemEvaluation 
} from '@/utils/masteryCalculator';
import { buildClosedItemContext } from '@/lib/answers/closedItemContext';
import { revealedExerciseIndices, answeredExerciseIndices } from '@/lib/answers/revealState';
import { DEFAULT_ENGLISH_LEVEL } from '../../supabase/functions/_shared/englishLevel';
import { createPendingSaves } from '@/lib/answers/pendingSaves';
import { parseAiEvaluation, mapItemEvaluationsToAiEvaluations } from '@/utils/aiEvaluationMapper';
import type { AiEvaluation } from '@/components/homework/AiEvaluationBadge';
import { devLog, devWarn } from '@/utils/logger';
import { questionIndicesOf, hasAnswerForQuestion } from '@/lib/answers/answerKeys';
import { callStudentAnswerRpc, callTokenOrLegacyRpc, studentAnswerRpcName } from '@/lib/answers/studentAnswerRpc';

// Same project values the generated client uses; read from env instead of hardcoding them.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface UseInteractiveSharedWorksheetProps {
  worksheetId: string;
  studentEmail: string;
  totalExercises: number;
  exerciseQuestionCounts?: Record<number, number>;
  exercises?: any[]; // For AI verification context
  /** Share token from the /shared/:token URL; proves access when the queue is processed. */
  shareToken?: string;
}

export const useInteractiveSharedWorksheet = ({
  worksheetId,
  studentEmail,
  totalExercises,
  exerciseQuestionCounts = {},
  exercises = [],
  shareToken = ''
}: UseInteractiveSharedWorksheetProps) => {
  const [answers, setAnswers] = useState<Record<number, ExerciseAnswers>>({});
  const [audioAnswers, setAudioAnswers] = useState<Record<number, Record<number, string>>>({});
  const [itemEvaluations, setItemEvaluations] = useState<Record<number, any[]>>({});
  const [aiEvaluations, setAiEvaluations] = useState<Record<number, Record<number, AiEvaluation>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  // Answer keys are revealed per exercise (finished, or an open exercise with its AI evaluation).
  const [revealedExercises, setRevealedExercises] = useState<ReadonlySet<number>>(new Set());
  const revealExercises = useCallback((indices: number[]) => {
    if (indices.length === 0) return;
    setRevealedExercises((prev) => (indices.every((i) => prev.has(i)) ? prev : new Set([...prev, ...indices])));
  }, []);
  const isSubmittedForReview = revealedExercises.size > 0;
  
  const pendingSavesQueueRef = useRef(createPendingSaves());
  const pendingSavesRef = useRef<Set<number>>(new Set());
  // True while at least one save failed and is waiting for a retry (shown in the progress bar).
  const [saveFailed, setSaveFailed] = useState(false);
  // One error toast per failure streak: the queue retries on its own.
  const saveErrorShownRef = useRef(false);
  const lastUnloadWriteRef = useRef(0);
  useEffect(() => pendingSavesQueueRef.current.onStatus((st) => setSaveFailed(st.failed > 0)), []);
  
  // PROBLEM 1 FIX: Active time tracking per exercise
  const exerciseStartTimeRef = useRef<Record<number, number>>({});
  const exerciseActiveTimeRef = useRef<Record<number, number>>({});
  const isTabActiveRef = useRef(true);
  const exerciseTypesRef = useRef<Record<number, string>>({});

  // Verify student email against database
  const verifyStudentEmail = useCallback(async (worksheetId: string, email: string): Promise<boolean> => {
    try {
      devLog('[useInteractiveSharedWorksheet] Verifying email:', email, 'for worksheet:', worksheetId);
      
      const { data, error } = await supabase.rpc('verify_worksheet_student_email', {
        p_worksheet_id: worksheetId,
        p_email: email.trim().toLowerCase()
      });

      if (error) {
        console.error('[useInteractiveSharedWorksheet] Verification error:', error);
        throw error;
      }

      devLog('[useInteractiveSharedWorksheet] Verification result:', data);
      return data === true;
    } catch (error) {
      console.error('Error verifying student email:', error);
      return false;
    }
  }, []);

  // Load existing answers from database
  const loadAnswers = useCallback(async () => {
    if (!worksheetId || !studentEmail) return;
    
    try {
      setIsLoading(true);
      devLog('[useInteractiveSharedWorksheet] Loading answers for:', worksheetId, studentEmail);
      
      const { data, error } = await callStudentAnswerRpc('get_worksheet_student_answers', {
        p_worksheet_id: worksheetId,
        p_student_email: studentEmail.trim().toLowerCase()
      }, shareToken);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedAnswers: Record<number, ExerciseAnswers> = {};
        const loadedEvals: Record<number, any[]> = {};
        const loadedAudio: Record<number, Record<number, string>> = {};
        const loadedAiEvals: Record<number, Record<number, AiEvaluation>> = {};

        data.forEach((answer: any) => {
          loadedAnswers[answer.exercise_index] = answer.answers;
          if (answer.item_evaluations && Array.isArray(answer.item_evaluations)) {
            loadedEvals[answer.exercise_index] = answer.item_evaluations;
          }
          // FIX 1.2: Load audio_answers from DB
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
          // Parse canonical ai_evaluation (priority) or fallback to item_evaluations
          const parsed = parseAiEvaluation(answer.ai_evaluation) 
            ?? mapItemEvaluationsToAiEvaluations(answer.item_evaluations);
          if (parsed) {
            loadedAiEvals[answer.exercise_index] = parsed;
          }
        });

        setAnswers(loadedAnswers);
        setItemEvaluations(loadedEvals);
        setAudioAnswers(loadedAudio);
        setAiEvaluations(loadedAiEvals);
        
        // Check if any answer has been completed or has AI evaluation
        const hasCompletedOrAiEval = revealedExerciseIndices(data);
        revealExercises(hasCompletedOrAiEval);
        
        devLog('[useInteractiveSharedWorksheet] Loaded answers:', loadedAnswers, 'audio:', loadedAudio, 'evals:', loadedEvals, 'aiEvals:', loadedAiEvals, 'revealed exercises:', hasCompletedOrAiEval);
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
  }, [worksheetId, studentEmail, shareToken]);

  // PROBLEM 1 FIX: Calculate active time for an exercise
  const getActiveTimeMs = useCallback((exerciseIndex: number): number => {
    const accumulated = exerciseActiveTimeRef.current[exerciseIndex] || 0;
    const startTime = exerciseStartTimeRef.current[exerciseIndex];
    
    if (startTime && isTabActiveRef.current) {
      return accumulated + (Date.now() - startTime);
    }
    return accumulated;
  }, []);

  // Save a single exercise answer to database
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
      
      // PROBLEM 1 FIX: Include active time in save
      const activeTimeMs = getActiveTimeMs(exerciseIndex);
      
      const { error } = await callStudentAnswerRpc('save_worksheet_answer', {
        p_worksheet_id: worksheetId,
        p_student_email: studentEmail.trim().toLowerCase(),
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
      
      // Show save confirmation only if no other saves are pending
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
  }, [worksheetId, studentEmail, getActiveTimeMs, shareToken]);

  // Debounced auto-save function (1.5 seconds for real-time feel)
  const scheduleAutoSave = useCallback((exerciseIndex: number, exerciseType: string, exerciseAnswers: ExerciseAnswers) => {
    // Mark this exercise as pending save
    pendingSavesRef.current.add(exerciseIndex);
    setIsSaving(true);

    // PROBLEM 1: Build per-item evaluations with nano_skill_ratings
    const exerciseData = { ...exercises[exerciseIndex], worksheetId };
    const mastery = calculateOverallMastery(exerciseType, exerciseData, exerciseAnswers as Record<string | number, any>);
    const itemEvaluations = buildItemEvaluations(exerciseData, exerciseAnswers as Record<string | number, any>, exerciseType, null, audioAnswers[exerciseIndex] || null);
    
    // PROBLEM 1 FIX: Don't send item_evaluations if they contain no real AI eval data
    // This prevents overwriting genuine AI evaluations in the DB via COALESCE
    const hasRealAiEval = itemEvaluations?.some(e => e.hasValue !== false);
    const evalToSend = hasRealAiEval ? itemEvaluations : null;
    
    devLog('[useInteractiveSharedWorksheet] Saving with itemEvaluations:', {
      exerciseIndex,
      exerciseType,
      mastery,
      itemEvaluationsCount: itemEvaluations?.length || 0,
      hasRealAiEval,
      sendingEvals: !!evalToSend
    });
    
    // Per-exercise debounce (1.5 s): another exercise's edits must not cancel this save
    pendingSavesQueueRef.current.schedule(exerciseIndex, () =>
      saveAnswer(exerciseIndex, exerciseType, exerciseAnswers, mastery, evalToSend)
    );
  }, [saveAnswer, exercises]);

  // Update answer and schedule auto-save
  const updateAnswer = useCallback((
    exerciseIndex: number, 
    exerciseType: string,
    questionIndex: number, 
    value: any
  ) => {
    // PROBLEM 1 FIX: Start tracking time for this exercise if not already
    if (!exerciseStartTimeRef.current[exerciseIndex]) {
      exerciseStartTimeRef.current[exerciseIndex] = Date.now();
    }
    
    // Store exercise type for AI verification
    exerciseTypesRef.current[exerciseIndex] = exerciseType;
    
    setAnswers(prev => {
      const exerciseAnswers = prev[exerciseIndex] || {};
      const updated = {
        ...prev,
        [exerciseIndex]: {
          ...exerciseAnswers,
          [questionIndex]: value
        }
      };

      // Schedule auto-save with updated answers
      scheduleAutoSave(exerciseIndex, exerciseType, updated[exerciseIndex]);

      return updated;
    });
  }, [scheduleAutoSave]);

  // Save immediately on blur (when user leaves input field)
  const saveOnBlur = useCallback((exerciseIndex: number, exerciseType: string) => {
    const exerciseAnswers = answers[exerciseIndex];
    if (!exerciseAnswers) return;
    // PROBLEM 1: Build per-item evaluations with nano_skill_ratings
    const exerciseData = { ...exercises[exerciseIndex], worksheetId };
    const mastery = calculateOverallMastery(exerciseType, exerciseData, exerciseAnswers as Record<string | number, any>);
    const itemEvaluations = buildItemEvaluations(exerciseData, exerciseAnswers as Record<string | number, any>, exerciseType, null, audioAnswers[exerciseIndex] || null);
    // PROBLEM 1 FIX: Don't send item_evaluations if they contain no real AI eval data
    const hasRealAiEval = itemEvaluations?.some(e => e.hasValue !== false);
    const evalToSend = hasRealAiEval ? itemEvaluations : null;
    // Save this exercise right now through the queue (serialized and retried); other exercises keep their pending saves.
    const queue = pendingSavesQueueRef.current;
    queue.schedule(exerciseIndex, () => saveAnswer(exerciseIndex, exerciseType, exerciseAnswers, mastery, evalToSend), 0);
    void queue.flushOne(exerciseIndex);
  }, [answers, saveAnswer, exercises]);

  // Calculate progress - percentage based on individual tasks, exercises based on full completion
  const getProgress = useCallback((): SharedWorksheetProgress => {
    let answeredExercises = 0;
    let totalTasks = 0;
    let answeredTasks = 0;
    
    for (let i = 0; i < totalExercises; i++) {
      const questionCount = exerciseQuestionCounts[i] || 1;
      totalTasks += questionCount;
    }
    
    // FIX 1.3: Merge text answers and audio answers for complete progress
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

  // Load answers on mount
  useEffect(() => {
    if (worksheetId && studentEmail) {
      loadAnswers();
    }
  }, [worksheetId, studentEmail, loadAnswers]);

  // PROBLEM 1 FIX: Visibility change tracking for active time
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab became inactive - pause all timers
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
        // Tab became active - restart timers
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

  // PLAN FIX: AI verification on tab/window close using fetch with keepalive
  // USES CONDITIONAL LOGIC: Only queue AI eval if last_saved_at > last_ai_eval_at
  useEffect(() => {
    const handleBeforeUnload = async () => {
      // beforeunload and pagehide both fire when a tab closes: send the keepalive writes once.
      if (Date.now() - lastUnloadWriteRef.current < 3000) return;
      lastUnloadWriteRef.current = Date.now();
      // Iterate through all exercises with answers
      // Only exercises with unsaved changes: a keepalive write of an already saved
      // exercise would reset eval_trigger and re-date its DSLM event for nothing.
      for (const exerciseIndex of pendingSavesQueueRef.current.pendingIndices()) {
        const exerciseType = exerciseTypesRef.current[exerciseIndex];
        const exerciseAnswers = answers[exerciseIndex];
        
        // Skip if no answers
        if (!exerciseAnswers || Object.keys(exerciseAnswers).length === 0) continue;
        
        const activeTimeMs = getActiveTimeMs(exerciseIndex);
        
        // 1. Save the answer itself using fetch with keepalive (ALWAYS)
        const rpcName = studentAnswerRpcName('save_worksheet_answer', shareToken);
        const saveData = {
          ...(rpcName.endsWith('_by_share_token') ? { p_share_token: shareToken } : {}),
          p_worksheet_id: worksheetId,
          p_student_email: studentEmail.trim().toLowerCase(),
          p_exercise_index: exerciseIndex,
          p_exercise_type: exerciseType,
          p_answers: exerciseAnswers,
          p_time_spent_ms: activeTimeMs
        };
        
        fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(saveData),
          keepalive: true
        }).catch(() => {});
        
        // close_tab AI evaluation REMOVED - only save answers on tab close
      }
    };

    // pagehide also fires on mobile browsers, where beforeunload often does not.
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [answers, worksheetId, studentEmail, exercises, getActiveTimeMs, shareToken]);

  // Flush pending saves on unmount so the last second of answers is not dropped
  useEffect(() => {
    const queue = pendingSavesQueueRef.current;
    return () => {
      void queue.flush();
    };
  }, []);

  // PLAN FIX: 10-minute inactivity timer for auto AI evaluation
  const lastAiEvalTriggerRef = useRef<number>(0);
  
  useEffect(() => {
    const TEN_MINUTES = 10 * 60 * 1000;
    const ONE_MINUTE = 60 * 1000;
    
    const checkAndTriggerAiEval = async () => {
      if (!lastSavedAt) return;
      
      const timeSinceLastSave = Date.now() - lastSavedAt.getTime();
      const timeSinceLastTrigger = Date.now() - lastAiEvalTriggerRef.current;
      
      // Only trigger if:
      // 1. More than 10 minutes since last save
      // 2. We haven't triggered since that save
      if (timeSinceLastSave >= TEN_MINUTES && lastSavedAt.getTime() > lastAiEvalTriggerRef.current) {
        devLog('[useInteractiveSharedWorksheet] 10 min passed, checking for pending AI evaluations');
        
        // Queue AI evaluations for all open-ended exercises
        for (const exerciseIndexStr of Object.keys(answers)) {
          const exerciseIndex = parseInt(exerciseIndexStr);
          const exerciseType = exerciseTypesRef.current[exerciseIndex];
          
          const isClosed = !!exerciseType && isClosedExerciseType(exerciseType);
          if (!OPEN_ENDED_EXERCISE_TYPES.includes(exerciseType) && !isClosed) continue;
          
          const exerciseAnswers = answers[exerciseIndex];
          if (!exerciseAnswers || Object.keys(exerciseAnswers).length === 0) continue;
          
          // Check if AI eval is actually needed using RPC
          try {
            const normalizedEmail = studentEmail.trim().toLowerCase();
            const { data: needsEval } = await callTokenOrLegacyRpc<boolean>(
              'needs_ai_evaluation_by_share_token',
              { p_share_token: shareToken ?? '', p_worksheet_id: worksheetId, p_student_email: normalizedEmail, p_exercise_index: exerciseIndex },
              'needs_ai_evaluation',
              { p_worksheet_id: worksheetId, p_student_email: normalizedEmail, p_exercise_index: exerciseIndex },
            );
            
            if (needsEval) {
              const exercise = exercises[exerciseIndex];
              // Closed items: answer key resolved client-side (same extractor as homework)
              const closedItems = isClosed
                ? questionIndicesOf(exerciseAnswers as Record<string | number, unknown>)
                    .map(qIdx => {
                      const ctx = buildClosedItemContext(exerciseType, exercise, qIdx, exerciseAnswers as Record<string | number, any>);
                      return ctx ? { question_index: qIdx, ...ctx } : null;
                    })
                    .filter(Boolean)
                : undefined;
              if (isClosed && (!closedItems || closedItems.length === 0)) continue;
              const queueArgs = {
                p_worksheet_id: worksheetId,
                p_student_email: normalizedEmail,
                p_exercise_index: exerciseIndex,
                p_exercise_type: exerciseType,
                p_answers: exerciseAnswers as any, // Cast to any for JSON compatibility
                // Anonymous students cannot read their level; process-pending-ai-evaluations
                // resolves it from the worksheet's student when the row is evaluated.
                p_english_level: DEFAULT_ENGLISH_LEVEL,
                p_context: {
                  title: exercise?.title || `Exercise ${exerciseIndex + 1}`,
                  questions: exercise?.questions || exercise?.prompts || exercise?.sentences || exercise?.expressions || exercise?.items || [],
                  ...(closedItems ? { closed_items: closedItems } : {}),
                } as any
              };
              await callTokenOrLegacyRpc(
                'queue_worksheet_ai_evaluation_by_share_token',
                { p_share_token: shareToken ?? '', ...queueArgs },
                'queue_worksheet_ai_evaluation',
                queueArgs,
              );
              devLog(`[useInteractiveSharedWorksheet] Queued AI eval for exercise ${exerciseIndex}`);
            }
          } catch (err) {
            console.error('[useInteractiveSharedWorksheet] Failed to queue AI eval:', err);
          }
        }
        
        // Mark that we've triggered
        lastAiEvalTriggerRef.current = lastSavedAt.getTime();
        
        // PLAN FIX 1C: Actually process the queued evaluations
        try {
          devLog('[useInteractiveSharedWorksheet] Calling process-pending-ai-evaluations after 10-min timer');
          const { error: processError } = await supabase.functions.invoke('process-pending-ai-evaluations', {
            body: {
              worksheet_id: worksheetId,
              trigger_source: '10min_inactivity',
              share_token: shareToken,
              student_email: studentEmail.trim().toLowerCase(),
            }
          });
          // A failed evaluation call must not unlock the answer keys.
          if (processError) throw processError;
          devLog('[useInteractiveSharedWorksheet] AI evaluations processed successfully');
          // Only the exercises the student answered; an unanswered exercise stays hidden.
          revealExercises(answeredExerciseIndices(answers as Record<number, Record<string | number, unknown>>));
        } catch (processErr) {
          devWarn('[useInteractiveSharedWorksheet] Failed to process AI evals (non-critical):', processErr);
        }
      }
    };
    
    // Check every minute
    const interval = setInterval(checkAndTriggerAiEval, ONE_MINUTE);
    
    return () => clearInterval(interval);
  }, [lastSavedAt, answers, worksheetId, studentEmail, exercises, shareToken, revealExercises]);

  // Polling: refresh aiEvaluations + itemEvaluations every 30s so student sees AI feedback without refresh
  useEffect(() => {
    if (!worksheetId || !studentEmail) return;
    
    const POLL_INTERVAL = 30_000; // 30 seconds
    
    const pollEvaluations = async () => {
      try {
        const { data, error } = await callStudentAnswerRpc('get_worksheet_student_answers', {
          p_worksheet_id: worksheetId,
          p_student_email: studentEmail.trim().toLowerCase()
        }, shareToken);
        
        if (error || !data) return;
        
        const loadedEvals: Record<number, any[]> = {};
        const loadedAiEvals: Record<number, Record<number, AiEvaluation>> = {};
        let hasNewEvals = false;
        
        data.forEach((answer: any) => {
          if (answer.item_evaluations && Array.isArray(answer.item_evaluations)) {
            loadedEvals[answer.exercise_index] = answer.item_evaluations;
            if (!itemEvaluations[answer.exercise_index] || 
                JSON.stringify(itemEvaluations[answer.exercise_index]) !== JSON.stringify(answer.item_evaluations)) {
              hasNewEvals = true;
            }
          }
          // Parse canonical ai_evaluation or fallback
          const parsed = parseAiEvaluation(answer.ai_evaluation) 
            ?? mapItemEvaluationsToAiEvaluations(answer.item_evaluations);
          if (parsed) {
            loadedAiEvals[answer.exercise_index] = parsed;
          }
        });
        
        // Reveal is derived from the stored rows, so it is refreshed on every poll.
        revealExercises(revealedExerciseIndices(data));
        if (hasNewEvals) {
          devLog('[useInteractiveSharedWorksheet] Polling found new evaluations:', loadedEvals);
          setItemEvaluations(loadedEvals);
          setAiEvaluations(loadedAiEvals);
        }
      } catch (err) {
        // Silent fail - polling is non-critical
      }
    };
    
    const interval = setInterval(pollEvaluations, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [worksheetId, studentEmail, itemEvaluations, shareToken, revealExercises]);

  // Update audio answer for a specific exercise/question
  const updateAudioAnswer = useCallback((exerciseIndex: number, questionIndex: number, audioUrl: string) => {
    const newAudioForExercise = { ...(audioAnswers[exerciseIndex] || {}), [questionIndex]: audioUrl };
    
    setAudioAnswers(prev => ({
      ...prev,
      [exerciseIndex]: {
        ...(prev[exerciseIndex] || {}),
        [questionIndex]: audioUrl
      }
    }));
    
    // FIX 1.2+1.4: Save audio_answers to DB so they persist after refresh + SQL triggers fire
    const exerciseType = exerciseTypesRef.current[exerciseIndex] || exercises[exerciseIndex]?.type || exercises[exerciseIndex]?.exercise_type || '';
    const currentAnswers = answers[exerciseIndex] || {};
    const exerciseData = { ...exercises[exerciseIndex], worksheetId };
    const mastery = calculateOverallMastery(exerciseType, exerciseData, currentAnswers as Record<string | number, any>);
    const itemEvals = buildItemEvaluations(exerciseData, currentAnswers as Record<string | number, any>, exerciseType, null, newAudioForExercise);
    const hasRealAiEval = itemEvals?.some(e => e.hasValue !== false);
    const evalToSend = hasRealAiEval ? itemEvals : null;
    const queue = pendingSavesQueueRef.current;
    queue.schedule(exerciseIndex, () => saveAnswer(exerciseIndex, exerciseType, currentAnswers, mastery, evalToSend, newAudioForExercise), 0);
    void queue.flushOne(exerciseIndex);
    
    devLog('[useInteractiveSharedWorksheet] Audio answer saved to DB:', { exerciseIndex, questionIndex, audioUrl: audioUrl.substring(0, 50) });
  }, [answers, exercises, saveAnswer, worksheetId, audioAnswers]);

  return {
    answers,
    audioAnswers,
    itemEvaluations,
    aiEvaluations,
    isLoading,
    isSaving,
    saveFailed,
    lastSavedAt,
    isSubmittedForReview,
    revealedExercises,
    updateAnswer,
    updateAudioAnswer,
    saveOnBlur,
    verifyStudentEmail,
    getProgress,
    refetchAnswers: loadAnswers
  };
};
