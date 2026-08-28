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

import { matchAnswer } from '@/lib/answers/matchAnswer';

/**
 * Text correctness for DSLM.
 * Uses the shared matcher; an uncertain ("review") verdict yields `null`
 * so the item is excluded from mastery instead of scoring 0.
 */
const textVerdict = (
  studentAnswer: unknown,
  correctAnswer: unknown,
  mode: 'word' | 'sentence',
  sourceSentence?: string
): boolean | null => {
  const { verdict } = matchAnswer(studentAnswer, correctAnswer, { mode, sourceSentence });
  if (verdict === 'correct') return true;
  if (verdict === 'wrong') return false;
  return null; // 'review' / 'empty' => not scored
};

// Seeded random for deterministic shuffle (same algorithm as UI components)
function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return function() {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return (hash % 1000) / 1000;
  };
}

function shuffleArrayWithSeed(array: any[], seed: string) {
  const newArray = [...array];
  const random = seededRandom(seed);
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

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

// Exercise type classification
export const CLOSED_EXERCISE_TYPES = [
  'multiple-choice', 'multiple-choice-audio', 'multiple-choice-picture',
  'true-false', 'true-false-audio', 'true-false-picture', 'matching', 'matching-halves',
  'fill-in-blanks', 'fill-in-blanks-audio', 'categorize',
  'complete-word', 'negative-prefixes', 'odd-one-out', 'synonyms-antonyms',
  'synonyms', 'antonyms', 'error-correction', 'gap-text', 'word-order'
];

export const OPEN_ENDED_EXERCISE_TYPES = [
  'reading', 'discussion', 'describe', 'answer-questions', 
  'dialogue', 'answer-questions-audio', 'describe-picture',
  'answer-questions-picture', 'paraphrasing', 'speaking',
  'sentence-transformation', 'essay',
  'listening-comprehension'
];

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
 * Check if exercise type is closed (auto-gradable)
 */
export const isClosedExerciseType = (exerciseType: string): boolean => {
  const normalizedType = exerciseType.replace('-picture', '').replace('-audio', '');
  return CLOSED_EXERCISE_TYPES.some(t => 
    exerciseType === t || normalizedType === t.replace('-audio', '').replace('-picture', '')
  );
};

/**
 * Calculate mastery for a SINGLE item in a closed exercise
 * Returns 0-100 or null for open-ended items
 */
export const calculateItemMastery = (
  exerciseType: string,
  exerciseData: any,
  itemIndex: number,
  studentAnswer: any,
  allAnswers?: Record<string | number, any>
): number | null => {
  // No answer = null mastery (but check for multi-blank gap-text composite keys first)
  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
    if (exerciseType === 'gap-text' && allAnswers && allAnswers[`${itemIndex}_0`] !== undefined) {
      // Multi-blank gap-text: answer exists under composite keys, continue
    } else {
      return null;
    }
  }

  // Open-ended exercises require teacher-reviewed evaluation.
  if (!isClosedExerciseType(exerciseType)) {
    return null;
  }

  let isCorrect: boolean | null = null;

  try {
    // Multiple choice (including variants)
    if (exerciseType.startsWith('multiple-choice') && exerciseData?.questions?.[itemIndex]) {
      const question = exerciseData.questions[itemIndex];
      if (question.options && Array.isArray(question.options)) {
        const correctOption = question.options.find((o: any) => o.correct === true);
        if (correctOption) {
          isCorrect = studentAnswer === correctOption.text || 
                     studentAnswer === correctOption.label ||
                     studentAnswer === correctOption.value;
        }
      }
    }

    // True/False
    if (exerciseType.startsWith('true-false') && exerciseData?.statements?.[itemIndex]) {
      const statement = exerciseData.statements[itemIndex];
      const expectedValue = statement.isTrue;
      if (expectedValue !== undefined) {
        let normalizedAnswer: boolean | null = null;
        if (typeof studentAnswer === 'boolean') {
          normalizedAnswer = studentAnswer;
        } else if (studentAnswer === 'true' || studentAnswer === true) {
          normalizedAnswer = true;
        } else if (studentAnswer === 'false' || studentAnswer === false) {
          normalizedAnswer = false;
        }
        if (normalizedAnswer !== null) {
          isCorrect = normalizedAnswer === expectedValue;
        }
      }
    }

    // Matching - uses shuffled definitions with seed
    if (exerciseType === 'matching' && exerciseData?.items?.[itemIndex]) {
      const item = exerciseData.items[itemIndex];
      if (typeof studentAnswer === 'string' && studentAnswer.length === 1 && studentAnswer.match(/[A-Z]/i)) {
        // Letter-based answer: reproduce same shuffle as ExerciseMatching.tsx
        const itemsKey = exerciseData.items.map((i: any) => i.term).join('|');
        const seed = itemsKey;
        const shuffled = shuffleArrayWithSeed(exerciseData.items, seed);
        const correctShuffledIdx = shuffled.findIndex((i: any) => i.term === item.term);
        if (correctShuffledIdx !== -1) {
          const correctLetter = String.fromCharCode(65 + correctShuffledIdx);
          isCorrect = studentAnswer.toUpperCase() === correctLetter;
        }
      } else {
        // Fallback: direct text comparison
        const correctMatch = item.correct_match || item.match || item.definition;
        if (correctMatch !== undefined) {
          isCorrect = String(studentAnswer).toLowerCase().trim() === String(correctMatch).toLowerCase().trim();
        }
      }
    }

    // Matching Halves - needs deterministic shuffle calculation
    if (exerciseType === 'matching-halves' && exerciseData?.sentence_halves?.[itemIndex]) {
      const allHalves = exerciseData.sentence_halves;
      const halvesKey = allHalves.map((h: any) => (h.first_half || '').trim()).join('|');
      const seed = `halves-${halvesKey}`;
      
      const shuffleIndicesWithSeed = (length: number, seedStr: string): number[] => {
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
          const char = seedStr.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        const random = () => {
          hash = (hash * 1103515245 + 12345) & 0x7fffffff;
          return (hash % 1000) / 1000;
        };
        
        const indices = Array.from({ length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        return indices;
      };
      
      const shuffledIndices = shuffleIndicesWithSeed(allHalves.length, seed);
      const shuffledPosition = shuffledIndices.indexOf(itemIndex);
      
      if (shuffledPosition !== -1 && typeof studentAnswer === 'string') {
        const correctLetter = String.fromCharCode(65 + shuffledPosition);
        isCorrect = studentAnswer.toUpperCase() === correctLetter;
      }
    }

    // Fill in blanks (including fill-in-blanks-audio)
    if (exerciseType.startsWith('fill-in-blanks')) {
      // For fill-in-blanks-audio, answers may be in exerciseData.answers array
      if (exerciseType === 'fill-in-blanks-audio' && exerciseData?.answers?.[itemIndex]) {
        const correctAnswer = exerciseData.answers[itemIndex];
        if (correctAnswer && typeof studentAnswer === 'string') {
          isCorrect = textVerdict(studentAnswer, correctAnswer, 'word');
        }
      } else if (exerciseData?.sentences?.[itemIndex]) {
        const sentence = exerciseData.sentences[itemIndex];
        const correctAnswer = typeof sentence === 'string' ? null : (sentence.answer || sentence.correct || sentence.missing_word);
        if (correctAnswer && typeof studentAnswer === 'string') {
          isCorrect = textVerdict(studentAnswer, correctAnswer, 'word');
        }
      }
    }

    // Categorize
    if (exerciseType === 'categorize' && exerciseData?.categories && exerciseData?.items) {
      const item = exerciseData.items[itemIndex];
      if (item) {
        const itemWord = typeof item === 'string' ? item : (item.word || item.text);
        let correctCategoryIndex = -1;
        exerciseData.categories.forEach((cat: any, catIdx: number) => {
          if (cat.correct_items) {
            const found = cat.correct_items.some((ci: any) => {
              const ciWord = typeof ci === 'string' ? ci : (ci.word || ci.text);
              return ciWord && itemWord && ciWord.toLowerCase() === itemWord.toLowerCase();
            });
            if (found) correctCategoryIndex = catIdx;
          }
        });
        if (correctCategoryIndex !== -1) {
          const studentCatIdx = typeof studentAnswer === 'number' ? studentAnswer : parseInt(studentAnswer);
          isCorrect = studentCatIdx === correctCategoryIndex;
        }
      }
    }

    // Complete word
    if (exerciseType === 'complete-word' && exerciseData?.words?.[itemIndex]) {
      const word = exerciseData.words[itemIndex];
      const correctWord = typeof word === 'string' ? word : (word.word || word.complete || word.complete_word);
      if (correctWord && typeof studentAnswer === 'string') {
        isCorrect = textVerdict(studentAnswer, correctWord, 'word');
      }
    }

    // Negative prefixes
    if (exerciseType === 'negative-prefixes' && exerciseData?.words?.[itemIndex]) {
      const word = exerciseData.words[itemIndex];
      const correctPrefix = typeof word === 'string' ? null : (word.prefix || word.answer);
      if (correctPrefix && typeof studentAnswer === 'string') {
        isCorrect = textVerdict(studentAnswer, correctPrefix, 'word');
      }
    }

    // Odd one out
    if (exerciseType === 'odd-one-out' && exerciseData?.questions?.[itemIndex]) {
      const question = exerciseData.questions[itemIndex];
      const correctAnswer = question.odd_word || question.correct || question.correct_answer;
      if (correctAnswer) {
        isCorrect = textVerdict(studentAnswer, correctAnswer, 'word');
      }
    }

    // Synonyms/Antonyms - uses shuffled definitions with seed
    if ((exerciseType === 'synonyms-antonyms' || exerciseType === 'synonyms' || exerciseType === 'antonyms') && exerciseData?.items?.[itemIndex]) {
      const item = exerciseData.items[itemIndex];
      // For letter-based answers (A, B, C...), reproduce same shuffle as ExerciseSynonymsAntonyms.tsx
      if (item.definition && typeof studentAnswer === 'string' && studentAnswer.length === 1 && studentAnswer.match(/[A-Z]/i)) {
        const itemsKey = exerciseData.items.map((i: any) => i.term).join('|');
        const seed = `syn-${itemsKey}`;
        const shuffled = shuffleArrayWithSeed(exerciseData.items, seed);
        const correctShuffledIdx = shuffled.findIndex((i: any) => i.term === item.term);
        if (correctShuffledIdx !== -1) {
          const correctLetter = String.fromCharCode(65 + correctShuffledIdx);
          isCorrect = studentAnswer.toUpperCase() === correctLetter;
        }
      } else {
        // Direct text answer
        const correctAnswer = item.answer || item.synonym || item.antonym;
        if (correctAnswer && typeof studentAnswer === 'string') {
          isCorrect = textVerdict(studentAnswer, correctAnswer, 'word');
        }
      }
    }

    // Error correction
    if (exerciseType === 'error-correction' && exerciseData?.sentences?.[itemIndex]) {
      const sentence = exerciseData.sentences[itemIndex];
      // Key fallbacks MUST mirror ExerciseErrorCorrection.tsx or UI and DSLM disagree.
      const correctAnswer = sentence.answer || sentence.correction || sentence.correct || sentence.corrected || sentence.correct_sentence;
      const sourceSentence = typeof sentence === 'string' ? '' : (sentence.incorrect || sentence.text || '');
      if (correctAnswer && typeof studentAnswer === 'string') {
        isCorrect = textVerdict(studentAnswer, correctAnswer, 'sentence', sourceSentence);
      }
    }

    // Gap text (cloze) — supports multi-blank with keys like `${sIndex}_${blankIndex}`
    if (exerciseType === 'gap-text' && exerciseData?.sentences?.[itemIndex]) {
      const sentence = exerciseData.sentences[itemIndex];
      const sentenceText = typeof sentence === 'string' ? sentence : (sentence?.text || '');
      const blanksCount = (sentenceText.match(/_+/g) || []).length;
      
      if (blanksCount > 1 && allAnswers) {
        // Multi-blank: check composite keys like "0_0", "0_1"
        const rawAnswer = sentence.answer || sentence.correct || '';
        const correctParts = rawAnswer.includes(' / ') ? rawAnswer.split(/\s*\/\s*/) : [rawAnswer];
        let allCorrectFlag = true;
        for (let b = 0; b < blanksCount; b++) {
          const blankKey = `${itemIndex}_${b}`;
          const blankAnswer = allAnswers[blankKey];
          const expected = correctParts[b] || correctParts[0] || '';
          if (!blankAnswer || textVerdict(blankAnswer, expected, 'word') !== true) {
            allCorrectFlag = false;
            break;
          }
        }
        isCorrect = allCorrectFlag;
      } else {
        // Single blank (backward compatible)
        const correctAnswer = sentence.answer || sentence.correct || sentence.missing_word;
        if (correctAnswer && typeof studentAnswer === 'string') {
          isCorrect = textVerdict(studentAnswer, correctAnswer, 'word');
        }
      }
    }

    // Word order
    if (exerciseType === 'word-order' && exerciseData?.sentences?.[itemIndex]) {
      const sentence = exerciseData.sentences[itemIndex];
      const correctAnswer = sentence.correct_order || sentence.correct || sentence.answer;
      if (correctAnswer && typeof studentAnswer === 'string') {
        isCorrect = textVerdict(studentAnswer, correctAnswer, 'sentence');
      }
    }

    // Return mastery based on correctness
    if (isCorrect === true) {
      return 100; // Correct answer = 100%
    } else if (isCorrect === false) {
      return 0; // Incorrect answer = 0%
    }

    return null; // Can't determine
  } catch (e) {
    console.error('[calculateItemMastery] Error:', e);
    return null;
  }
};

/**
 * Get exercise items array from exercise data (handles various structures)
 */
export const getExerciseItems = (exerciseData: any): any[] => {
  if (!exerciseData) return [];
  return exerciseData.questions || 
         exerciseData.items || 
         exerciseData.sentences || 
         exerciseData.statements || 
         exerciseData.words || 
         exerciseData.sentence_halves ||
         exerciseData.expressions ||
         exerciseData.prompts ||
         [];
};

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
export const calculateOverallMastery = (
  exerciseType: string,
  exerciseData: any,
  answers: Record<string | number, any>
): number | null => {
  if (!exerciseData || !answers || Object.keys(answers).length === 0) return null;
  if (!isClosedExerciseType(exerciseType)) return null;
  
  const items = getExerciseItems(exerciseData);
  let correct = 0;
  let total = 0;
  
  items.forEach((item: any, idx: number) => {
    const mastery = calculateItemMastery(exerciseType, exerciseData, idx, answers[idx], answers);
    if (mastery !== null) {
      if (mastery >= 50) correct++;
      total++;
    }
  });
  
  return total > 0 ? Math.round((correct / total) * 100) : null;
};
