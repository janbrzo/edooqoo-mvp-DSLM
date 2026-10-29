/**
 * Minutes per exercise type, by lesson length and grammar presence. One table for
 * the Edge Function (canonical save) and the client (`src/utils/timeCalculator.ts`
 * re-exports it), so a saved worksheet and a freshly generated one carry the same
 * `time`. Pure, no I/O, no path aliases.
 */

const TIME_MAP = {
  '45min': {
    withGrammar: { // 45min total: 5 warmup + 10 grammar + 30 exercises = 45min
      'reading': 7,
      'multiple-choice': 5,
      'fill-in-blanks': 4,
      'matching': 5,
      'dialogue': 6,
      'discussion': 3,
      'error-correction': 3,
      'word-formation': 4,
      'word-order': 4,
      'true-false': 3,
      'odd-one-out': 4,
      'synonyms': 5,
      'antonyms': 5,
      'synonyms-antonyms': 5,
      'sentence-transformation': 6,
      'gap-text': 4,
      'negative-prefixes': 3,
      // Audio exercises
      'listening-comprehension': 12,
      'multiple-choice-audio': 10,
      'true-false-audio': 6,
      'fill-in-blanks-audio': 10,
      'answer-questions-audio': 10
    },
    withoutGrammar: { // 45min total: 5 warmup + 0 grammar + 40 exercises = 45min
      'reading': 8,
      'multiple-choice': 6,
      'fill-in-blanks': 5,
      'matching': 6,
      'dialogue': 7,
      'discussion': 4,
      'error-correction': 4,
      'word-formation': 5,
      'word-order': 5,
      'true-false': 5,
      'odd-one-out': 5,
      'synonyms': 6,
      'antonyms': 6,
      'synonyms-antonyms': 6,
      'sentence-transformation': 7,
      'gap-text': 5,
      'negative-prefixes': 4,
      // Audio exercises
      'listening-comprehension': 12,
      'multiple-choice-audio': 10,
      'true-false-audio': 6,
      'fill-in-blanks-audio': 10,
      'answer-questions-audio': 10
    }
  },
  '60min': {
    withGrammar: { // 60min total: 5 warmup + 15 grammar + 40 exercises = 60min
      'reading': 7,
      'multiple-choice': 5,
      'fill-in-blanks': 4,
      'matching': 5,
      'dialogue': 6,
      'discussion': 6,
      'error-correction': 4,
      'word-formation': 4,
      'word-order': 4,
      'true-false': 3,
      'odd-one-out': 4,
      'synonyms': 5,
      'antonyms': 5,
      'synonyms-antonyms': 5,
      'sentence-transformation': 6,
      'gap-text': 4,
      'negative-prefixes': 3,
      // Audio exercises
      'listening-comprehension': 12,
      'multiple-choice-audio': 10,
      'true-false-audio': 6,
      'fill-in-blanks-audio': 10,
      'answer-questions-audio': 10
    },
    withoutGrammar: { // 60min total: 5 warmup + 0 grammar + 55 exercises = 60min
      'reading': 9,
      'multiple-choice': 7,
      'fill-in-blanks': 5,
      'matching': 6,
      'dialogue': 8,
      'discussion': 9,
      'error-correction': 6,
      'word-formation': 6,
      'word-order': 6,
      'true-false': 5,
      'odd-one-out': 5,
      'synonyms': 6,
      'antonyms': 6,
      'synonyms-antonyms': 6,
      'sentence-transformation': 8,
      'gap-text': 5,
      'negative-prefixes': 4,
      // Audio exercises
      'listening-comprehension': 12,
      'multiple-choice-audio': 10,
      'true-false-audio': 6,
      'fill-in-blanks-audio': 10,
      'answer-questions-audio': 10
    }
  }
};

/** Minutes for one exercise type; unknown types get the 3 minute minimum. */
export const getExerciseTimeByType = (exerciseType: string, lessonTime: string, hasGrammar: boolean = true): number => {
  // Normalize lesson time format - handle both "45min" and "45 min" formats
  const normalizedLessonTime = String(lessonTime ?? '').replace(/\s+/g, '');
  // Anything but 45min/60min falls back to 45min.
  const lessonConfig = TIME_MAP[normalizedLessonTime as keyof typeof TIME_MAP] ?? TIME_MAP['45min'];
  const grammarConfig = hasGrammar ? lessonConfig.withGrammar : lessonConfig.withoutGrammar;
  return grammarConfig[exerciseType as keyof typeof grammarConfig] || 3;
};
