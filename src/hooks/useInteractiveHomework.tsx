import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { 
  HomeworkStudentAnswer, 
  ExerciseAnswers,
  HomeworkProgress 
} from '@/types/interactiveHomework';
import { AiEvaluation } from '@/components/homework/AiEvaluationBadge';
import { 
  buildItemEvaluations, 
  calculateOverallMastery,
  OPEN_ENDED_EXERCISE_TYPES,
  ItemEvaluation 
} from '@/utils/masteryCalculator';
import { devLog } from '@/utils/logger';
import { transcribeAllAudio, buildAnswersToVerify } from '@/utils/audioEvalUtils';


interface UseInteractiveHomeworkProps {
  homeworkId: string;
  sourceWorksheetId?: string;
  studentEmail: string;
  totalExercises: number;
  exerciseQuestionCounts?: Record<number, number>;
  exercises?: any[];
}

export const useInteractiveHomework = ({
  homeworkId,
  sourceWorksheetId,
  studentEmail,
  totalExercises,
  exerciseQuestionCounts = {},
  exercises = []
}: UseInteractiveHomeworkProps) => {
  const [answers, setAnswers] = useState<Record<number, ExerciseAnswers>>({});
  const [audioAnswers, setAudioAnswers] = useState<Record<number, Record<number, string>>>({});
  const [aiEvaluations, setAiEvaluations] = useState<Record<number, Record<number, AiEvaluation>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);
  const [isWaitingForAiEval, setIsWaitingForAiEval] = useState(false);
  
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const pendingSavesRef = useRef<Set<number>>(new Set());
  
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
      
      const { data, error } = await supabase.rpc('get_student_homework_answers', {
        p_homework_id: homeworkId,
        p_student_email: studentEmail
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedAnswers: Record<number, ExerciseAnswers> = {};
        const loadedEvaluations: Record<number, Record<number, AiEvaluation>> = {};
        const loadedAudio: Record<number, Record<number, string>> = {};
        let allSubmitted = true;

        data.forEach((answer: any) => {
          loadedAnswers[answer.exercise_index] = answer.answers;
          
          if (answer.ai_evaluation) {
            const evalData = answer.ai_evaluation;
            if (evalData.question_evaluations && Array.isArray(evalData.question_evaluations)) {
              loadedEvaluations[answer.exercise_index] = {};
              evalData.question_evaluations.forEach((qEval: any) => {
                loadedEvaluations[answer.exercise_index][qEval.question_index] = qEval;
              });
            } else if (evalData.is_acceptable !== undefined) {
              loadedEvaluations[answer.exercise_index] = { 0: evalData as AiEvaluation };
            }
          }
          
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
        setAiEvaluations(loadedEvaluations);
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
  }, [homeworkId, studentEmail]);

  const getActiveTimeMs = useCallback((exerciseIndex: number): number => {
    const accumulated = exerciseActiveTimeRef.current[exerciseIndex] || 0;
    const startTime = exerciseStartTimeRef.current[exerciseIndex];
    
    if (startTime && isTabActiveRef.current) {
      return accumulated + (Date.now() - startTime);
    }
    return accumulated;
  }, []);

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
      
      const activeTimeMs = getActiveTimeMs(exerciseIndex);
      
      const { error } = await supabase.rpc('save_homework_answer', {
        p_homework_id: homeworkId,
        p_student_email: studentEmail,
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
  }, [homeworkId, studentEmail, getActiveTimeMs]);

  const scheduleAutoSave = useCallback((exerciseIndex: number, exerciseType: string, exerciseAnswers: ExerciseAnswers) => {
    if (isSubmitted) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    pendingSavesRef.current.add(exerciseIndex);
    setIsSaving(true);

    const effectiveWorksheetId = sourceWorksheetId || homeworkId;
    const exerciseData = { ...exercises[exerciseIndex], worksheetId: effectiveWorksheetId };
    const mastery = calculateOverallMastery(exerciseType, exerciseData, exerciseAnswers as Record<string | number, any>);
    const itemEvaluations = buildItemEvaluations(exerciseData, exerciseAnswers as Record<string | number, any>, exerciseType, null, audioAnswers[exerciseIndex] || null);

    devLog('[useInteractiveHomework] Saving with itemEvaluations:', {
      exerciseIndex,
      exerciseType,
      mastery,
      itemEvaluationsCount: itemEvaluations?.length || 0
    });

    saveTimeoutRef.current = setTimeout(() => {
      saveAnswer(exerciseIndex, exerciseType, exerciseAnswers, mastery, itemEvaluations);
    }, 1500);
  }, [saveAnswer, exercises, isSubmitted]);

  const updateAnswer = useCallback((
    exerciseIndex: number, 
    exerciseType: string,
    questionIndex: number, 
    value: any
  ) => {
    if (!exerciseStartTimeRef.current[exerciseIndex]) {
      exerciseStartTimeRef.current[exerciseIndex] = Date.now();
    }
    
    setAnswers(prev => {
      const exerciseAnswers = prev[exerciseIndex] || {};
      const updated = {
        ...prev,
        [exerciseIndex]: {
          ...exerciseAnswers,
          [questionIndex]: value
        }
      };

      scheduleAutoSave(exerciseIndex, exerciseType, updated[exerciseIndex]);

      return updated;
    });
  }, [scheduleAutoSave]);

  const saveOnBlur = useCallback((exerciseIndex: number, exerciseType: string) => {
    if (isSubmitted) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const exerciseAnswers = answers[exerciseIndex];
    if (exerciseAnswers) {
      const effectiveWorksheetId = sourceWorksheetId || homeworkId;
      const exerciseData = { ...exercises[exerciseIndex], worksheetId: effectiveWorksheetId };
      const mastery = calculateOverallMastery(exerciseType, exerciseData, exerciseAnswers as Record<string | number, any>);
      const itemEvaluations = buildItemEvaluations(exerciseData, exerciseAnswers as Record<string | number, any>, exerciseType, null, audioAnswers[exerciseIndex] || null);
      saveAnswer(exerciseIndex, exerciseType, exerciseAnswers, mastery, itemEvaluations);
    }
  }, [answers, saveAnswer, exercises, isSubmitted]);

  const submitHomework = useCallback(async () => {
    try {
      setIsSaving(true);

      const pendingMap = (window as any).__pendingSpeakingRecordings as Map<string, { save: () => Promise<void> }> | undefined;
      if (pendingMap && pendingMap.size > 0) {
        devLog(`[submitHomework] Flushing ${pendingMap.size} pending recordings...`);
        await Promise.all(Array.from(pendingMap.values()).map(e => e.save().catch(console.error)));
        await new Promise(r => setTimeout(r, 500));
      }

      const { error } = await supabase.rpc('submit_homework_answers', {
        p_homework_id: homeworkId,
        p_student_email: studentEmail
      });

      if (error) throw error;

      setIsSubmitted(true);
      setSubmittedAt(new Date());

      // Emit homework_submitted event for DSLM Layer A
      try {
        const { data: hwData } = await supabase
          .from('homework_assignments')
          .select('teacher_id, student_id')
          .eq('id', homeworkId)
          .single();
        
        if (hwData?.student_id && hwData?.teacher_id) {
          await supabase.rpc('add_student_event', {
            p_student_id: hwData.student_id,
            p_teacher_id: hwData.teacher_id,
            p_event_type: 'homework_submitted',
            p_event_source: 'homework',
            p_source_id: homeworkId,
            p_event_payload: {
              homework_id: homeworkId,
              total_exercises: totalExercises,
              answered_exercises: Object.keys(answers).length
            } as unknown as Record<string, never>,
            p_skill_ids: null,
            p_element_type: null,
            p_session_id: null
          });
          devLog('[submitHomework] homework_submitted event emitted');
        }
      } catch (e) {
        console.warn('[submitHomework] Failed to emit homework_submitted event:', e);
      }

      const openAnswerTypes = [
        'reading', 'discussion', 'describe', 'answer-questions', 
        'dialogue', 'answer-questions-audio', 'describe-picture',
        'answer-questions-picture', 'paraphrasing', 'speaking',
        'sentence-transformation', 'essay',
        'listening-comprehension'
      ];
      
      devLog('[submitHomework] Starting AI verification process...');
      devLog('[submitHomework] Recognized open answer types:', openAnswerTypes);
      setIsWaitingForAiEval(true);
      
      try {
        const { data: savedAnswers } = await supabase.rpc('get_student_homework_answers', {
          p_homework_id: homeworkId,
          p_student_email: studentEmail
        });

        devLog('[submitHomework] Fetched saved answers:', savedAnswers?.length || 0);
        
        if (savedAnswers && savedAnswers.length > 0) {
          const allTypes = savedAnswers.map((a: any) => a.exercise_type);
          devLog('[submitHomework] All exercise types:', allTypes);
          
          const answersToVerify: any[] = [];
          
          // Transcribe all audio using shared utility
          const transcriptionCache = await transcribeAllAudio(audioAnswers, '[submitHomework]');
          
          // Merge transcriptions into local savedAnswers for AI eval (NO DB writes yet — will persist with AI eval)
          if (Object.keys(transcriptionCache).length > 0) {
            for (const [cacheKey, transcription] of Object.entries(transcriptionCache)) {
              const [exIdxStr, qIdxStr] = cacheKey.split('_');
              const exIdx = parseInt(exIdxStr);
              const qIdx = parseInt(qIdxStr);
              const ans = savedAnswers.find((a: any) => a.exercise_index === exIdx);
              if (ans) {
                const existingAnswers = (typeof ans.answers === 'object' && ans.answers !== null) ? ans.answers : {};
                ans.answers = { ...existingAnswers, [`_transcription_${qIdx}`]: transcription.text };
              }
            }
            devLog('[submitHomework] Transcriptions merged into local savedAnswers (DB write deferred)');
          }
          
          for (const ans of savedAnswers.filter((a: any) => {
            const isOpen = openAnswerTypes.includes(a.exercise_type);
            devLog(`[submitHomework] Exercise ${a.exercise_index}: type=${a.exercise_type}, isOpen=${isOpen}`);
            return isOpen;
          })) {
            const exerciseData = exercises[ans.exercise_index];
            
            // Use shared utility for building answers from union of written + audio
            const exerciseAnswers = buildAnswersToVerify({
              savedAnswer: { exercise_index: ans.exercise_index, exercise_type: ans.exercise_type, answers: (ans.answers || {}) as Record<string | number, any> },
              exerciseData,
              audioAnswers,
              transcriptionCache
            });
            answersToVerify.push(...exerciseAnswers);
          }

          if (answersToVerify.length > 0) {
            devLog('[submitHomework] Verifying', answersToVerify.length, 'individual questions');
            
            const { data: verifyResult, error: verifyError } = await supabase.functions.invoke('verify-open-answers', {
              body: { 
                answers: answersToVerify, 
                english_level: 'Intermediate',
                context: 'Homework submission - individual question evaluation'
              }
            });

            if (!verifyError && verifyResult?.evaluations) {
              devLog('[submitHomework] AI evaluation received:', verifyResult.evaluations.length, 'results');
              
              const groupedEvaluations: Record<number, Record<number, AiEvaluation>> = {};
              const dbUpdates: Record<number, { question_evaluations: any[] }> = {};
              
              for (const evaluation of verifyResult.evaluations) {
                const exIdx = evaluation.exercise_index ?? evaluation.question_index;
                const qIdx = evaluation.question_index ?? 0;
                
                if (!groupedEvaluations[exIdx]) {
                  groupedEvaluations[exIdx] = {};
                  dbUpdates[exIdx] = { question_evaluations: [] };
                }
                
                groupedEvaluations[exIdx][qIdx] = {
                  is_acceptable: evaluation.is_acceptable,
                  quality_score: evaluation.quality_score,
                  writing_score: evaluation.writing_score,
                  speaking_score: evaluation.speaking_score,
                  feedback: evaluation.feedback,
                  question_index: qIdx
                };
                
                dbUpdates[exIdx].question_evaluations.push({
                  question_index: qIdx,
                  is_acceptable: evaluation.is_acceptable,
                  quality_score: evaluation.quality_score,
                  writing_score: evaluation.writing_score,
                  speaking_score: evaluation.speaking_score,
                  feedback: evaluation.feedback
                });
              }
              
              for (const [exIdxStr, evalData] of Object.entries(dbUpdates)) {
                const exIdx = parseInt(exIdxStr);
                
                const exerciseData = exercises[exIdx];
                const questionItems = exerciseData?.questions || exerciseData?.prompts || exerciseData?.sentences || exerciseData?.expressions || exerciseData?.items || [];
                
                const aiEvalLookup: Record<number, { quality_score?: number; writing_score?: number; speaking_score?: number }> = {};
                if (evalData.question_evaluations) {
                  evalData.question_evaluations.forEach((qEval: any) => {
                    const qIdx = qEval.question_index ?? 0;
                    aiEvalLookup[qIdx] = {
                      quality_score: qEval.quality_score,
                      writing_score: qEval.writing_score,
                      speaking_score: qEval.speaking_score,
                    };
                  });
                }
                const studentAnswersForThisExercise = answers[exIdx] || {};
                const itemEvals = buildItemEvaluations(
                  exerciseData, studentAnswersForThisExercise as Record<string | number, any>, 
                  savedAnswers.find((a: any) => a.exercise_index === exIdx)?.exercise_type || '',
                  aiEvalLookup, audioAnswers[exIdx] || null
                ) || [];
                
                const overallMastery = itemEvals.length > 0
                  ? Math.round(itemEvals.reduce((sum, e) => sum + e.mastery, 0) / itemEvals.length)
                  : null;
                
                // Merge transcriptions into answers for this exercise (single DB write with AI eval)
                const ansForEx = savedAnswers.find((a: any) => a.exercise_index === exIdx);
                const mergedAnswers = (typeof ansForEx?.answers === 'object' && ansForEx?.answers !== null) ? { ...ansForEx.answers } : {};
                
                await supabase
                  .from('homework_student_answers')
                  .update({ 
                    answers: mergedAnswers,
                    ai_evaluation: evalData,
                    item_evaluations: JSON.parse(JSON.stringify(itemEvals)),
                    mastery: overallMastery,
                    eval_trigger: 'submit_homework'
                  })
                  .eq('homework_id', homeworkId)
                  .eq('student_email', studentEmail)
                  .eq('exercise_index', exIdx);
              }
              
              setAiEvaluations(prev => {
                const updated = { ...prev };
                for (const [exIdx, questionEvals] of Object.entries(groupedEvaluations)) {
                  updated[parseInt(exIdx)] = questionEvals as Record<number, AiEvaluation>;
                }
                return updated;
              });
              setIsWaitingForAiEval(false);
            } else if (verifyError) {
              console.error('[submitHomework] AI verification error:', verifyError);
              setIsWaitingForAiEval(false);
            }
          }
          
          // Persist transcriptions for exercises that had audio but NO AI eval
          // (e.g. non-open exercise types with audio recordings, or when AI eval had no results for them)
          if (Object.keys(transcriptionCache).length > 0) {
            // Collect exercise indexes that already got a merged DB write above
            const exercisesAlreadyPersisted = new Set<number>();
            for (const [cacheKey] of Object.entries(transcriptionCache)) {
              const exIdx = parseInt(cacheKey.split('_')[0]);
              // Check if this exercise was part of the AI eval DB updates by looking at savedAnswers
              // that already have _transcription_ keys merged (done in the dbUpdates loop)
              const ans = savedAnswers.find((a: any) => a.exercise_index === exIdx);
              if (ans?.answers && typeof ans.answers === 'object') {
                const keys = Object.keys(ans.answers);
                if (keys.some(k => k.startsWith('_transcription_'))) {
                  // Check if this exercise had an AI eval update (mergedAnswers was written)
                  // We can detect this by checking if eval_trigger would have been set
                  // Simple approach: check answersToVerify had entries for this exercise
                  const hadAiEval = answersToVerify.some((a: any) => a.exercise_index === exIdx);
                  if (hadAiEval) {
                    exercisesAlreadyPersisted.add(exIdx);
                  }
                }
              }
            }
            
            for (const [cacheKey, transcription] of Object.entries(transcriptionCache)) {
              const [exIdxStr, qIdxStr] = cacheKey.split('_');
              const exIdx = parseInt(exIdxStr);
              if (exercisesAlreadyPersisted.has(exIdx)) continue;
              
              const ans = savedAnswers.find((a: any) => a.exercise_index === exIdx);
              if (!ans) continue;
              const existingAnswers = (typeof ans.answers === 'object' && ans.answers !== null) ? { ...ans.answers } : {};
              existingAnswers[`_transcription_${qIdxStr}`] = transcription.text;
              
              await supabase
                .from('homework_student_answers')
                .update({ answers: existingAnswers })
                .eq('homework_id', homeworkId)
                .eq('student_email', studentEmail)
                .eq('exercise_index', exIdx);
            }
            devLog('[submitHomework] Transcriptions persisted for non-AI-eval exercises');
          }
        }
      } catch (aiError) {
        console.error('[submitHomework] AI verification failed (non-blocking):', aiError);
        setIsWaitingForAiEval(false);
      }

      try {
        const { error: notifError } = await supabase.rpc('insert_homework_submission_notification', {
          p_homework_id: homeworkId
        });
        
        if (notifError) {
          console.error('[submitHomework] RPC notification error:', notifError);
        } else {
          devLog('[submitHomework] Notification created successfully');
        }
      } catch (notifError) {
        console.error('[submitHomework] Failed to create notification:', notifError);
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
      setIsSaving(false);
    }
  }, [homeworkId, studentEmail, audioAnswers, exercises]);

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
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const updateAudioAnswer = useCallback((exerciseIndex: number, questionIndex: number, audioUrl: string) => {
    if (isSubmitted) return;

    const newAudioForExercise = { ...(audioAnswers[exerciseIndex] || {}), [questionIndex]: audioUrl };
    
    setAudioAnswers(prev => ({
      ...prev,
      [exerciseIndex]: {
        ...(prev[exerciseIndex] || {}),
        [questionIndex]: audioUrl
      }
    }));
    
    const exerciseType = exercises[exerciseIndex]?.type || exercises[exerciseIndex]?.exercise_type || '';
    const currentAnswers = answers[exerciseIndex] || {};
    const effectiveWorksheetId = sourceWorksheetId || homeworkId;
    const exerciseData = { ...exercises[exerciseIndex], worksheetId: effectiveWorksheetId };
    const mastery = calculateOverallMastery(exerciseType, exerciseData, currentAnswers as Record<string | number, any>);
    const itemEvals = buildItemEvaluations(exerciseData, currentAnswers as Record<string | number, any>, exerciseType, null, newAudioForExercise);
    saveAnswer(exerciseIndex, exerciseType, currentAnswers, mastery, itemEvals, newAudioForExercise);
    
    devLog('[useInteractiveHomework] Audio answer saved to DB:', { exerciseIndex, questionIndex, audioUrl: audioUrl.substring(0, 50) });
  }, [answers, exercises, saveAnswer, sourceWorksheetId, homeworkId, audioAnswers, isSubmitted]);

  return {
    answers,
    audioAnswers,
    aiEvaluations,
    isLoading,
    isSaving,
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
