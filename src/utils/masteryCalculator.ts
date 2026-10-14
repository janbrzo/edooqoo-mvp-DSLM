/**
 * ============================================
 * Per-Item Mastery Calculator Utility
 * ============================================
 * 
 * Centralized logic for calculating individual item mastery (0-100)
 * for closed exercises. Used by:
 * - useInteractiveSharedWorksheet
 * - useInteractiveHomework
 * - NanoSkillMasteryModal
 */


import { calculateItemMastery, isClosedExerciseType, CLOSED_EXERCISE_TYPES, shuffleArrayWithSeed, averageScoredMastery, scoreToMastery, aiAlternativeMastery, applyAiAlternatives, isSelectionType, OPEN_EXERCISE_TYPES, isOpenExerciseType, getExerciseItems, calculateExerciseMastery } from '../../supabase/functions/_shared/itemMastery';

// Closed-item scoring lives in supabase/functions/_shared/itemMastery.ts so Edge Functions and the client share one verdict.
export { calculateItemMastery, isClosedExerciseType, CLOSED_EXERCISE_TYPES, shuffleArrayWithSeed, averageScoredMastery, scoreToMastery, aiAlternativeMastery, applyAiAlternatives, isSelectionType, OPEN_EXERCISE_TYPES, isOpenExerciseType };

export interface ItemEvaluation {
  question_index: number;  // Index pytania w ćwiczeniu (0-based)
  name: string;
  reason: string;
  mastery: number;
  hasValue?: boolean;
  confidence?: number;
}

export interface NanoSkillData {
  name: string;
  reason: string;
  confidence?: number;
}

/** Shared with Edge Functions: `OPEN_EXERCISE_TYPES` in supabase/functions/_shared/itemMastery.ts. */
export const OPEN_ENDED_EXERCISE_TYPES = OPEN_EXERCISE_TYPES;

/**
 * Safely extract nano_skill from an item (handles various data structures)
 * Returns the FIRST nano_skill (primary)
 */
export const safeGetNanoSkill = (item: any): NanoSkillData | null => {
  if (!item) return null;
  
  let ns = item?.nano_skill || item?.nanoSkill;
  
  // Handle arrays - take first element (primary skill)
  if (Array.isArray(ns)) {
    ns = ns[0];
  }
  
  if (ns && ns.name) {
    return {
      name: ns.name,
      reason: ns.reason || '',
      confidence: ns.confidence
    };
  }
  return null;
};

/**
 * Safely extract ALL nano_skills from an item (for dual nano_skill support)
 * Returns array of all nano_skills (primary + writing)
 */
export const safeGetAllNanoSkills = (item: any): NanoSkillData[] => {
  if (!item) return [];
  
  const ns = item?.nano_skill || item?.nanoSkill;
  if (!ns) return [];
  
  // Handle arrays - return all elements
  if (Array.isArray(ns)) {
    return ns
      .filter((s: any) => s && typeof s === 'object' && s.name)
      .map((s: any) => ({
        name: s.name,
        reason: s.reason || '',
        confidence: s.confidence
      }));
  }
  
  // Single object - wrap in array
  if (typeof ns === 'object' && ns.name) {
    return [{
      name: ns.name,
      reason: ns.reason || '',
      confidence: ns.confidence
    }];
  }
  
  return [];
};

/**
 * Get exercise items array from exercise data (handles various structures)
 */
export { getExerciseItems };

/**
 * Adjust nano_skill confidence based on answer type (audio vs text)
 * - Speaking skill: high confidence (0.90) if audio recorded, low (0.30) if only text
 * - Writing skill: high confidence (0.90) if text written, medium (0.70) if only audio (from transcription)
 * - Both audio+text: both get high confidence (0.90)
 */
export const adjustConfidenceByAnswerType = (
  nanoSkills: NanoSkillData[],
  hasTextAnswer: boolean,
  hasAudioAnswer: boolean
): NanoSkillData[] => {
  return nanoSkills.map(ns => {
    const nsName = ns.name.toLowerCase();
    const isSpeaking = nsName.includes('.speaking.') || nsName.includes('.sp.');
    const isWriting = nsName.includes('.writing.') || nsName.includes('.wr.');
    
    if (isSpeaking) {
      if (hasAudioAnswer) {
        return { ...ns, confidence: 0.90 };
      } else if (hasTextAnswer) {
        return { ...ns, confidence: 0.30 };
      }
    }
    
    if (isWriting) {
      if (hasTextAnswer) {
        return { ...ns, confidence: 0.90 };
      } else if (hasAudioAnswer) {
        return { ...ns, confidence: 0.70 };
      }
    }
    
    return ns;
  });
};

/**
 * Build per-item evaluations for an exercise
 * Returns array of { name, reason, mastery } for each item with nano_skill
 */
export const buildItemEvaluations = (
  exerciseData: any,
  answers: Record<string | number, any>,
  exerciseType: string,
  aiEvaluations?: Record<number, { quality_score?: number; writing_score?: number; speaking_score?: number }> | null,
  audioAnswers?: Record<number, string> | null
): ItemEvaluation[] | null => {
  if (!exerciseData) return null;
  
  const itemEvaluations: ItemEvaluation[] = [];
  const items = getExerciseItems(exerciseData);
  
  items.forEach((item: any, idx: number) => {
    // Get ALL nano_skills (primary + secondary writing + speaking)
    const allNanoSkills = safeGetAllNanoSkills(item);
    if (allNanoSkills.length === 0) return;
    
    // Skip questions without student answers (written or audio)
    let studentAnswer = answers[idx];
    // For gap-text multi-blank, check composite keys like "0_0"
    if (exerciseType === 'gap-text' && (studentAnswer === undefined || studentAnswer === null)) {
      const compositeKey = `${idx}_0`;
      if (answers[compositeKey] !== undefined) {
        studentAnswer = answers[compositeKey]; // Use first blank as "has answer" indicator
      }
    }
    const hasStudentAnswer = studentAnswer !== undefined && 
                             studentAnswer !== null && 
                             String(studentAnswer).trim() !== '';
    const hasAudioAnswer = audioAnswers?.[idx] != null;
    if (!hasStudentAnswer && !hasAudioAnswer) return;
    
    let itemMastery: number | null = null;
    const aiEval = aiEvaluations?.[idx];
    
    // For open-ended, use AI evaluation if available
    if (!isClosedExerciseType(exerciseType)) {
      if (aiEval?.quality_score !== undefined) {
        itemMastery = Math.round(aiEval.quality_score * 100);
      } else {
        itemMastery = null;
      }
    } else {
      itemMastery = calculateItemMastery(exerciseType, exerciseData, idx, studentAnswer, answers);
    }
    
    // Adjust confidence dynamically based on whether student used audio/text
    const hasTextForItem = studentAnswer !== undefined && studentAnswer !== null && String(studentAnswer).trim() !== '';
    const hasAudioForItem = audioAnswers?.[idx] != null;
    const adjustedNanoSkills = adjustConfidenceByAnswerType(allNanoSkills, hasTextForItem, hasAudioForItem);
    
    // Create evaluation for EACH nano_skill in the item
    // Map writing_score and speaking_score to the appropriate nano_skill
    // Adjust confidence dynamically based on answer type (audio vs text)
    adjustedNanoSkills.forEach((nanoSkill) => {
      const nsName = nanoSkill.name.toLowerCase();
      let skillMastery = itemMastery;
      
      // If AI returned separate writing/speaking scores, use them for matching nano_skills
      if (aiEval && !isClosedExerciseType(exerciseType)) {
        if (nsName.includes('.writing.') || nsName.includes('.wr.')) {
          // Writing nano_skill gets writing_score if available
          if (aiEval.writing_score !== undefined) {
            skillMastery = Math.round(aiEval.writing_score * 100);
          }
        } else if (nsName.includes('.speaking.') || nsName.includes('.sp.')) {
          // Speaking nano_skill gets speaking_score if available
          if (aiEval.speaking_score !== undefined) {
            skillMastery = Math.round(aiEval.speaking_score * 100);
          } else {
            // No audio was submitted - don't evaluate speaking, keep as unevaluated
            skillMastery = -1;
          }
        }
        // Primary skill (reading/listening/grammar/vocab) keeps quality_score
      }
      
      itemEvaluations.push({
        question_index: idx,
        name: nanoSkill.name,
        reason: nanoSkill.reason,
        mastery: skillMastery !== null ? skillMastery : -1,
        hasValue: skillMastery !== null && skillMastery >= 0,
        confidence: nanoSkill.confidence,
      });
    });
  });
  
  return itemEvaluations.length > 0 ? itemEvaluations : null;
};

/**
 * Calculate overall mastery for a closed exercise (average of item masteries)
 */
/** Shared with the AI queue: `calculateExerciseMastery` in supabase/functions/_shared/itemMastery.ts. */
export const calculateOverallMastery = calculateExerciseMastery;

/** question_index -> stored mastery (first scored rating per question) from saved item_evaluations. */
export const storedItemMasteryByQuestion = (
  itemEvaluations: ReadonlyArray<{ question_index?: number; mastery?: number; hasValue?: boolean }> | null | undefined,
): Record<number, number> => {
  const out: Record<number, number> = {};
  for (const e of itemEvaluations || []) {
    const q = e?.question_index;
    if (typeof q !== 'number' || q in out) continue;
    if (e.hasValue === false || typeof e.mastery !== 'number' || !(e.mastery >= 0)) continue;
    out[q] = e.mastery;
  }
  return out;
};

/**
 * Initial slider value for one exercise item (decision D2: Mark done is a teacher
 * override on the 0-100 scale; saving it replaces the student's rating, so the
 * teacher starts from what the student's evaluation already holds).
 * Order: live AI evaluation, then the stored evaluation of the saved answer
 * (AI queue result, accepted alternative), then for closed items the key verdict
 * (`calculateItemMastery`: 100 correct, 0 wrong; when the key cannot decide the item
 * is left unrated, never a made-up 50).
 * An open item with neither has no value, so an unrated item never overrides a
 * real evaluation; no answer has no value either.
 */
export const calculateInitialMasteryForItem = (
  itemIndex: number,
  studentAnswers?: Record<number, any>,
  exerciseData?: any,
  aiEvaluations?: Record<number, number>,
  storedEvaluations?: Record<number, number>,
): { mastery: number | null; hasValue: boolean } => {
  if (aiEvaluations && typeof aiEvaluations[itemIndex] === 'number' && aiEvaluations[itemIndex] >= 0) {
    return { mastery: aiEvaluations[itemIndex], hasValue: true };
  }
  const studentAnswer = studentAnswers?.[itemIndex];
  const exerciseType: string = exerciseData?.type || '';
  const hasCompositeAnswer =
    exerciseType === 'gap-text' && studentAnswers?.[`${itemIndex}_0` as unknown as number] !== undefined;
  if ((studentAnswer === undefined || studentAnswer === null || studentAnswer === '') && !hasCompositeAnswer) {
    return { mastery: null, hasValue: false };
  }
  if (storedEvaluations && typeof storedEvaluations[itemIndex] === 'number') {
    return { mastery: storedEvaluations[itemIndex], hasValue: true };
  }
  if (!isClosedExerciseType(exerciseType)) return { mastery: null, hasValue: false };
  const keyMastery = calculateItemMastery(exerciseType, exerciseData, itemIndex, studentAnswer, studentAnswers);
  if (keyMastery === null || keyMastery === undefined) return { mastery: null, hasValue: false };
  return { mastery: keyMastery, hasValue: true };
};
