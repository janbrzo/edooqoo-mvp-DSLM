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
  ItemEvaluation 
} from '@/utils/masteryCalculator';
import { parseAiEvaluation, mapItemEvaluationsToAiEvaluations } from '@/utils/aiEvaluationMapper';
import type { AiEvaluation } from '@/components/homework/AiEvaluationBadge';
import { devLog, devWarn } from '@/utils/logger';

interface UseInteractiveSharedWorksheetProps {
  worksheetId: string;
  studentEmail: string;
  totalExercises: number;
  exerciseQuestionCounts?: Record<number, number>;
  exercises?: any[]; // For AI verification context
}

export const useInteractiveSharedWorksheet = ({
  worksheetId,
  studentEmail,
  totalExercises,
  exerciseQuestionCounts = {},
  exercises = []
}: UseInteractiveSharedWorksheetProps) => {
  const [answers, setAnswers] = useState<Record<number, ExerciseAnswers>>({});
  const [audioAnswers, setAudioAnswers] = useState<Record<number, Record<number, string>>>({});
  const [itemEvaluations, setItemEvaluations] = useState<Record<number, any[]>>({});
  const [aiEvaluations, setAiEvaluations] = useState<Record<number, Record<number, AiEvaluation>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSubmittedForReview, setIsSubmittedForReview] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const pendingSavesRef = useRef<Set<number>>(new Set());
  
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
      
      const { data, error } = await supabase.rpc('get_worksheet_student_answers', {
        p_worksheet_id: worksheetId,
        p_student_email: studentEmail.trim().toLowerCase()
      });

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
        const hasCompletedOrAiEval = data.some((a: any) => a.is_completed || a.ai_evaluation);
        if (hasCompletedOrAiEval) {
          setIsSubmittedForReview(true);
        }
        
        devLog('[useInteractiveSharedWorksheet] Loaded answers:', loadedAnswers, 'audio:', loadedAudio, 'evals:', loadedEvals, 'aiEvals:', loadedAiEvals, 'submittedForReview:', hasCompletedOrAiEval);
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
  }, [worksheetId, studentEmail]);

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
  ) => {
    try {
      setIsSaving(true);
      
      // PROBLEM 1 FIX: Include active time in save
      const activeTimeMs = getActiveTimeMs(exerciseIndex);
      
      const { error } = await supabase.rpc('save_worksheet_answer', {
        p_worksheet_id: worksheetId,
        p_student_email: studentEmail.trim().toLowerCase(),
        p_exercise_index: exerciseIndex,
        p_exercise_type: exerciseType,
        p_answers: exerciseAnswers as any,
        p_time_spent_ms: activeTimeMs,
        p_mastery: mastery ?? null,
        p_item_evaluations: itemEvaluations ? JSON.parse(JSON.stringify(itemEvaluations)) : null,
        p_audio_answers: audioAnswersForExercise ? JSON.parse(JSON.stringify(audioAnswersForExercise)) : null
      });

      if (error) throw error;

      setLastSavedAt(new Date());
      pendingSavesRef.current.delete(exerciseIndex);
      
      // Show save confirmation only if no other saves are pending
      if (pendingSavesRef.current.size === 0) {
        setIsSaving(false);
      }
    } catch (error: any) {
      console.error('Error saving answer:', error);
      toast({
        title: "Error saving answer",
        description: error.message,
        variant: "destructive"
      });
      setIsSaving(false);
    }
  }, [worksheetId, studentEmail, getActiveTimeMs]);

  // Debounced auto-save function (1.5 seconds for real-time feel)
  const scheduleAutoSave = useCallback((exerciseIndex: number, exerciseType: string, exerciseAnswers: ExerciseAnswers) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

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
    
    // Schedule new save (1.5 seconds for faster real-time updates)
    saveTimeoutRef.current = setTimeout(() => {
      saveAnswer(exerciseIndex, exerciseType, exerciseAnswers, mastery, evalToSend);
    }, 1500);
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
    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const exerciseAnswers = answers[exerciseIndex];
    if (exerciseAnswers) {
      // PROBLEM 1: Build per-item evaluations with nano_skill_ratings
      const exerciseData = { ...exercises[exerciseIndex], worksheetId };
      const mastery = calculateOverallMastery(exerciseType, exerciseData, exerciseAnswers as Record<string | number, any>);
      const itemEvaluations = buildItemEvaluations(exerciseData, exerciseAnswers as Record<string | number, any>, exerciseType, null, audioAnswers[exerciseIndex] || null);
      // PROBLEM 1 FIX: Don't send item_evaluations if they contain no real AI eval data
      const hasRealAiEval = itemEvaluations?.some(e => e.hasValue !== false);
      const evalToSend = hasRealAiEval ? itemEvaluations : null;
      saveAnswer(exerciseIndex, exerciseType, exerciseAnswers, mastery, evalToSend);
    }
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
      
      const allQIndices = new Set([
        ...Object.keys(exerciseAnswers).map(Number),
        ...Object.keys(exerciseAudio).map(Number)
      ]);
      
      let answeredQuestionsCount = 0;
      allQIndices.forEach(qIdx => {
        const hasText = exerciseAnswers[qIdx] !== null && exerciseAnswers[qIdx] !== undefined && exerciseAnswers[qIdx] !== '';
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
      // Iterate through all exercises with answers
      for (const exerciseIndexStr of Object.keys(answers)) {
        const exerciseIndex = parseInt(exerciseIndexStr);
        const exerciseType = exerciseTypesRef.current[exerciseIndex];
        const exerciseAnswers = answers[exerciseIndex];
        
        // Skip if no answers
        if (!exerciseAnswers || Object.keys(exerciseAnswers).length === 0) continue;
        
        const activeTimeMs = getActiveTimeMs(exerciseIndex);
        
        // 1. Save the answer itself using fetch with keepalive (ALWAYS)
        const saveData = {
          p_worksheet_id: worksheetId,
          p_student_email: studentEmail.trim().toLowerCase(),
          p_exercise_index: exerciseIndex,
          p_exercise_type: exerciseType,
          p_answers: exerciseAnswers,
          p_time_spent_ms: activeTimeMs
        };
        
        fetch(`https://bvfrkzdlklyvnhlpleck.supabase.co/rest/v1/rpc/save_worksheet_answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZnJremRsa2x5dm5obHBsZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyNDYyMzQsImV4cCI6MjA2MDgyMjIzNH0.RXlVKVPO4WTD6c4sA9fZIYAQe6zKPqoMoVE6Ilit9ls',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZnJremRsa2x5dm5obHBsZWNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyNDYyMzQsImV4cCI6MjA2MDgyMjIzNH0.RXlVKVPO4WTD6c4sA9fZIYAQe6zKPqoMoVE6Ilit9ls',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify(saveData),
          keepalive: true
        }).catch(() => {});
        
        // close_tab AI evaluation REMOVED - only save answers on tab close
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [answers, worksheetId, studentEmail, exercises, getActiveTimeMs]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
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
          
          if (!OPEN_ENDED_EXERCISE_TYPES.includes(exerciseType)) continue;
          
          const exerciseAnswers = answers[exerciseIndex];
          if (!exerciseAnswers || Object.keys(exerciseAnswers).length === 0) continue;
          
          // Check if AI eval is actually needed using RPC
          try {
            const { data: needsEval } = await supabase.rpc('needs_ai_evaluation', {
              p_worksheet_id: worksheetId,
              p_student_email: studentEmail.trim().toLowerCase(),
              p_exercise_index: exerciseIndex
            });
            
            if (needsEval) {
              const exercise = exercises[exerciseIndex];
              await supabase.rpc('queue_worksheet_ai_evaluation', {
                p_worksheet_id: worksheetId,
                p_student_email: studentEmail.trim().toLowerCase(),
                p_exercise_index: exerciseIndex,
                p_exercise_type: exerciseType,
                p_answers: exerciseAnswers as any, // Cast to any for JSON compatibility
                p_english_level: 'Intermediate',
                p_context: {
                  title: exercise?.title || `Exercise ${exerciseIndex + 1}`,
                  questions: exercise?.questions || exercise?.prompts || exercise?.sentences || exercise?.expressions || exercise?.items || []
                }
              });
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
          await supabase.functions.invoke('process-pending-ai-evaluations', {
            body: { worksheet_id: worksheetId, trigger_source: '10min_inactivity' }
          });
          devLog('[useInteractiveSharedWorksheet] AI evaluations processed successfully');
          setIsSubmittedForReview(true);
        } catch (processErr) {
          devWarn('[useInteractiveSharedWorksheet] Failed to process AI evals (non-critical):', processErr);
        }
      }
    };
    
    // Check every minute
    const interval = setInterval(checkAndTriggerAiEval, ONE_MINUTE);
    
    return () => clearInterval(interval);
  }, [lastSavedAt, answers, worksheetId, studentEmail, exercises]);

  // Polling: refresh aiEvaluations + itemEvaluations every 30s so student sees AI feedback without refresh
  useEffect(() => {
    if (!worksheetId || !studentEmail) return;
    
    const POLL_INTERVAL = 30_000; // 30 seconds
    
    const pollEvaluations = async () => {
      try {
        const { data, error } = await supabase.rpc('get_worksheet_student_answers', {
          p_worksheet_id: worksheetId,
          p_student_email: studentEmail.trim().toLowerCase()
        });
        
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
        
        if (hasNewEvals) {
          devLog('[useInteractiveSharedWorksheet] Polling found new evaluations:', loadedEvals);
          setItemEvaluations(loadedEvals);
          setAiEvaluations(loadedAiEvals);
          
          // Check if any answer has AI evaluation now
          const hasAiEval = data.some((a: any) => a.is_completed || a.ai_evaluation);
          if (hasAiEval) {
            setIsSubmittedForReview(true);
          }
        }
      } catch (err) {
        // Silent fail - polling is non-critical
      }
    };
    
    const interval = setInterval(pollEvaluations, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [worksheetId, studentEmail, itemEvaluations]);

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
    saveAnswer(exerciseIndex, exerciseType, currentAnswers, mastery, evalToSend, newAudioForExercise);
    
    devLog('[useInteractiveSharedWorksheet] Audio answer saved to DB:', { exerciseIndex, questionIndex, audioUrl: audioUrl.substring(0, 50) });
  }, [answers, exercises, saveAnswer, worksheetId, audioAnswers]);

  return {
    answers,
    audioAnswers,
    itemEvaluations,
    aiEvaluations,
    isLoading,
    isSaving,
    lastSavedAt,
    isSubmittedForReview,
    updateAnswer,
    updateAudioAnswer,
    saveOnBlur,
    verifyStudentEmail,
    getProgress,
    refetchAnswers: loadAnswers
  };
};
