/**
 * Shared closed-item scoring (answer key verdict).
 *
 * Single source of truth for "is this closed answer right per the key" used by the
 * client (re-exported from src/utils/masteryCalculator.ts) and Edge Functions
 * (closedItemContext key_verdict). Pure, no I/O, no path aliases.
 */
import { matchAnswer } from './matchAnswer.ts';

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

export function shuffleArrayWithSeed(array: any[], seed: string) {
  const newArray = [...array];
  const random = seededRandom(seed);
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// Exercise type classification
export const CLOSED_EXERCISE_TYPES = [
  'multiple-choice', 'multiple-choice-audio', 'multiple-choice-picture',
  'true-false', 'true-false-audio', 'true-false-picture', 'matching', 'matching-halves',
  'fill-in-blanks', 'fill-in-blanks-audio', 'categorize',
  'complete-word', 'negative-prefixes', 'odd-one-out', 'synonyms-antonyms',
  'synonyms', 'antonyms', 'error-correction', 'gap-text', 'word-order'
];

/**
 * Open exercise types: evaluated by the model (homework submit, worksheet queue,
 * Mark done in a live session). Single list for client and Edge Functions; both
 * the original and the '-picture'/'-audio' variants are listed because callers
 * match exact type names. Never overlaps CLOSED_EXERCISE_TYPES (parity test).
 */
export const OPEN_EXERCISE_TYPES = [
  'reading', 'discussion', 'describe', 'describe-picture', 'answer-questions',
  'answer-questions-audio', 'answer-questions-picture', 'dialogue', 'paraphrasing',
  'speaking', 'sentence-transformation', 'essay', 'listening-comprehension'
];

export const isOpenExerciseType = (exerciseType: string | null | undefined): boolean =>
  !!exerciseType && OPEN_EXERCISE_TYPES.includes(exerciseType);

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
          isCorrect = textVerdict(studentAnswer, correctMatch, 'word');
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

    // Gap text (cloze): supports multi-blank with keys like `${sIndex}_${blankIndex}`
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
    return null;
  }
};

/**
 * AI quality score (0..1) -> item mastery (0..100). A real 0 stays 0; a missing,
 * empty or non-numeric score returns -1 (unevaluated, excluded from mastery),
 * never a made-up default.
 */
export function scoreToMastery(score: unknown): number {
  const n = typeof score === 'number'
    ? score
    : typeof score === 'string' && score.trim() !== '' ? Number(score) : NaN;
  if (!Number.isFinite(n)) return -1;
  return Math.round(Math.max(0, Math.min(1, n)) * 100);
}

/**
 * Exercise mastery = mean of the scored items only. Items flagged hasValue=false
 * or with a negative sentinel (-1: not evaluated, e.g. speaking with no audio)
 * are left out instead of dragging the mean down. Null when nothing was scored.
 */
export function averageScoredMastery(
  items: ReadonlyArray<{ mastery: number; hasValue?: boolean }>,
): number | null {
  const scored = items.filter((e) => e.hasValue !== false && typeof e.mastery === 'number' && e.mastery >= 0);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((sum, e) => sum + e.mastery, 0) / scored.length);
}

/** Selection items: the student picks from a fixed set, so no alternative answer can be right. */
const SELECTION_PREFIXES = ['multiple-choice', 'true-false', 'matching', 'categorize', 'odd-one-out'];

export const isSelectionType = (t: string | undefined): boolean =>
  !!t && SELECTION_PREFIXES.some((p) => t.startsWith(p));

/** Lowest AI quality score that may raise a typed closed answer the key does not accept. */
export const AI_ALTERNATIVE_MIN_SCORE = 0.85;
/** A raised answer never scores like an exact key match. */
export const AI_ALTERNATIVE_MAX_MASTERY = 95;

export interface ClosedAiEvaluation {
  quality_score?: number;
  is_acceptable?: boolean;
  key_verdict?: string;
}

/**
 * Owner decision D1: the answer key decides; the AI may only RAISE a typed
 * closed answer that the key marks wrong or uncertain (a valid alternative,
 * e.g. "manager" for "boss"), never lower one and never touch selection items.
 * Returns the raised mastery (85-95), or null when the key result stands.
 */
export function aiAlternativeMastery(
  exerciseType: string,
  keyMastery: number | null,
  ai: ClosedAiEvaluation | null | undefined,
): number | null {
  if (!ai || isSelectionType(exerciseType)) return null;
  if (keyMastery !== null && keyMastery >= 50) return null; // the key already accepts it
  if (ai.key_verdict === 'correct') return null;
  const q = typeof ai.quality_score === 'number' ? ai.quality_score : NaN;
  if (ai.is_acceptable !== true || !Number.isFinite(q) || q < AI_ALTERNATIVE_MIN_SCORE) return null;
  return Math.min(AI_ALTERNATIVE_MAX_MASTERY, Math.round(q * 100));
}

export interface ScoredItem {
  question_index?: number;
  mastery: number;
  hasValue?: boolean;
}

/**
 * Apply raised answers (question_index -> mastery) to key-based item
 * evaluations. Every rating of a raised question gets the raised mastery and
 * `source: 'ai_alternative'`. The exercise mastery is recomputed the way
 * calculateOverallMastery does it: share of scored questions at >= 50.
 */
export function applyAiAlternatives<T extends ScoredItem>(
  items: readonly T[],
  raised: Record<number, number>,
): { items: Array<T & { source?: string }>; mastery: number | null; changed: boolean } {
  let changed = false;
  const out = items.map((it) => {
    const q = typeof it.question_index === 'number' ? it.question_index : -1;
    if (q in raised) {
      changed = true;
      return { ...it, mastery: raised[q], hasValue: true, source: 'ai_alternative' };
    }
    return it as T & { source?: string };
  });
  const byQuestion = new Map<number, number>();
  for (const it of out) {
    const q = typeof it.question_index === 'number' ? it.question_index : -1;
    if (q < 0 || it.hasValue === false || !(it.mastery >= 0) || byQuestion.has(q)) continue;
    byQuestion.set(q, it.mastery);
  }
  const scores = [...byQuestion.values()];
  const mastery = scores.length > 0
    ? Math.round((scores.filter((m) => m >= 50).length / scores.length) * 100)
    : null;
  return { items: out, mastery, changed };
}
