/**
 * Shared utilities for building AI evaluation payloads from written + audio answers.
 * Used by both useInteractiveHomework and useInteractiveSharedWorksheet.
 */

import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/utils/logger';

export interface TranscriptionResult {
  text: string;
  wordCount?: number;
  duration?: number;
}

export type TranscriptionCache = Record<string, TranscriptionResult>;

export interface AnswerToVerify {
  exercise_index: number;
  question_index: number;
  question_text: string;
  student_answer: string;
  suggested_answer?: string;
  exercise_type: string;
  audio_transcription?: string;
  audio_word_count?: number;
  audio_duration_seconds?: number;
}

/**
 * Transcribe all audio answers and build a cache of transcriptions.
 * Also persists transcriptions back to the answers object in the DB.
 */
export async function transcribeAllAudio(
  audioAnswers: Record<number, Record<number, string>>,
  logPrefix: string = '[transcribeAllAudio]'
): Promise<TranscriptionCache> {
  const cache: TranscriptionCache = {};

  for (const [exIdxStr, questionAudios] of Object.entries(audioAnswers)) {
    for (const [qIdxStr, audioUrl] of Object.entries(questionAudios as Record<number, string>)) {
      if (!audioUrl || !audioUrl.startsWith('http')) continue;
      const cacheKey = `${exIdxStr}_${qIdxStr}`;
      try {
        devLog(`${logPrefix} Transcribing audio for exercise ${exIdxStr}, question ${qIdxStr}`);
        const { data: transcResult, error: transcError } = await supabase.functions.invoke('transcribe-audio', {
          body: { audio_url: audioUrl }
        });
        
        // Enhanced diagnostics
        devLog(`${logPrefix} Invoke result for ${cacheKey}: error=${!!transcError}, data keys=${transcResult ? Object.keys(transcResult) : 'null'}`);
        
        if (transcError) {
          console.error(`${logPrefix} Transcription invoke error for ${cacheKey}:`, transcError);
          if (transcResult) console.error(`${logPrefix} Error response data:`, transcResult);
          continue;
        }
        
        // Check for error in response body (SDK sometimes puts errors in data, not error)
        if (transcResult?.error) {
          console.error(`${logPrefix} Transcription API error for ${cacheKey}:`, transcResult.error);
          continue;
        }
        
        if (transcResult?.transcription) {
          const words = transcResult.transcription.split(/\s+/).filter((w: string) => w.length > 0);
          cache[cacheKey] = {
            text: transcResult.transcription,
            wordCount: words.length,
            duration: undefined
          };
          devLog(`${logPrefix} Transcription success: ${words.length} words`);
        } else {
          console.warn(`${logPrefix} No transcription returned for ${cacheKey}`, transcResult);
        }
      } catch (err) {
        console.error(`${logPrefix} Transcription failed for ${cacheKey}:`, err);
      }
    }
  }

  return cache;
}

/**
 * Build answersToVerify from the union of written answers + audio transcriptions.
 * This ensures audio-only questions are included in AI evaluation.
 */
export function buildAnswersToVerify(params: {
  savedAnswer: { exercise_index: number; exercise_type: string; answers: Record<string | number, any> };
  exerciseData: any;
  audioAnswers: Record<number, Record<number, string>>;
  transcriptionCache: TranscriptionCache;
}): AnswerToVerify[] {
  const { savedAnswer, exerciseData, audioAnswers, transcriptionCache } = params;
  const result: AnswerToVerify[] = [];
  
  const studentAnswersForExercise = savedAnswer.answers || {};
  const questionItems = exerciseData?.questions || exerciseData?.prompts || exerciseData?.sentences || exerciseData?.expressions || exerciseData?.items || [];
  
  // Build union of question indexes from written answers + audio answers
  const allQuestionIndexes = new Set<number>();
  Object.keys(studentAnswersForExercise)
    .filter(k => !k.startsWith('_'))
    .forEach(k => {
      const idx = parseInt(k);
      if (!isNaN(idx)) allQuestionIndexes.add(idx);
    });
  const exerciseAudio = audioAnswers[savedAnswer.exercise_index] || {};
  Object.keys(exerciseAudio).forEach(k => allQuestionIndexes.add(parseInt(k)));

  for (const qIdx of allQuestionIndexes) {
    const questionItem = questionItems[qIdx];
    if (!questionItem) continue;
    
    const writtenAnswer = studentAnswersForExercise[qIdx];
    const transcKey = `${savedAnswer.exercise_index}_${qIdx}`;
    const transcription = transcriptionCache[transcKey];
    
    // Effective answer: written text, or transcription for audio-only
    const hasWritten = writtenAnswer && String(writtenAnswer).trim() !== '';
    const effectiveAnswer = hasWritten
      ? String(writtenAnswer)
      : (transcription ? transcription.text : null);
    
    if (!effectiveAnswer) continue;
    
    let questionText = '';
    let suggestedAnswer = '';
    
    if (typeof questionItem === 'string') {
      questionText = questionItem;
    } else {
      questionText = questionItem.text || questionItem.question || questionItem.prompt || questionItem.original || '';
      suggestedAnswer = questionItem.suggested_answer || questionItem.answer || questionItem.correct_answer || questionItem.correct || questionItem.transformed || '';
    }
    
    if (exerciseData?.instructions && qIdx === 0) {
      questionText = `[Instructions: ${exerciseData.instructions}]\n\n${questionText}`;
    }
    
    result.push({
      exercise_index: savedAnswer.exercise_index,
      question_index: qIdx,
      question_text: questionText,
      student_answer: hasWritten ? String(writtenAnswer) : '',
      suggested_answer: suggestedAnswer || undefined,
      exercise_type: savedAnswer.exercise_type,
      ...(transcription ? {
        audio_transcription: transcription.text,
        audio_word_count: transcription.wordCount,
        audio_duration_seconds: transcription.duration
      } : {})
    });
  }
  
  return result;
}

/**
 * Build a map of transcriptions keyed by exercise_index for persisting to DB answers field.
 * Returns { [exerciseIndex]: { [questionIndex]: { _transcription: text } } }
 */
export function buildTranscriptionUpdates(
  transcriptionCache: TranscriptionCache,
  existingAnswers: Record<number, Record<string | number, any>>
): Record<number, Record<string | number, any>> {
  const updates: Record<number, Record<string | number, any>> = {};
  
  for (const [cacheKey, transcription] of Object.entries(transcriptionCache)) {
    const [exIdxStr, qIdxStr] = cacheKey.split('_');
    const exIdx = parseInt(exIdxStr);
    const qIdx = parseInt(qIdxStr);
    
    if (!updates[exIdx]) {
      updates[exIdx] = { ...(existingAnswers[exIdx] || {}) };
    }
    
    // Store transcription alongside existing answer data
    // Use _transcription_ prefix to avoid collision with actual answer text
    updates[exIdx][`_transcription_${qIdx}`] = transcription.text;
  }
  
  return updates;
}
