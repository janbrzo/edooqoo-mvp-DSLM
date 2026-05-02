
export interface WorksheetTimes {
  warmup: number;
  grammar: number;
  exercisesTotal: number;
  suggestedPerExercise: number;
  totalLesson: number;
}

export const calculateWorksheetTimes = (lessonTime: string, hasGrammar: boolean = true): WorksheetTimes => {
  const totalMinutes = lessonTime === '45min' ? 45 : 60;
  
  const warmup = 5; // Always 5 minutes
  const grammar = hasGrammar ? (lessonTime === '45min' ? 10 : 15) : 0;
  const exercisesTotal = totalMinutes - warmup - grammar;
  
  // Calculate suggested exercise count and time
  const suggestedExerciseCount = lessonTime === '45min' ? 4 : 5;
  const suggestedPerExercise = Math.round(exercisesTotal / suggestedExerciseCount);
  
  return {
    warmup,
    grammar,
    exercisesTotal,
    suggestedPerExercise,
    totalLesson: totalMinutes
  };
};

// Fixed exercise times based on lesson duration and grammar presence - updated with exact specifications
export const getExerciseTimeByType = (exerciseType: string, lessonTime: string, hasGrammar: boolean = true): number => {
  console.log(`🔧 getExerciseTimeByType called with:`, { exerciseType, lessonTime, hasGrammar });
  
  const timeMap = {
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
  
  // Normalize lesson time format - handle both "45min" and "45 min" formats
  const normalizedLessonTime = lessonTime.replace(/\s+/g, ''); // Remove all spaces
  console.log(`🔧 Normalized lesson time from "${lessonTime}" to "${normalizedLessonTime}"`);
  
  const lessonConfig = timeMap[normalizedLessonTime as keyof typeof timeMap];
  if (!lessonConfig) {
    console.warn(`🔧 No lesson config found for "${normalizedLessonTime}", falling back to 45min`);
    const fallbackConfig = timeMap['45min'];
    const grammarConfig = hasGrammar ? fallbackConfig.withGrammar : fallbackConfig.withoutGrammar;
    const result = grammarConfig[exerciseType as keyof typeof grammarConfig] || 3; // Minimum 3 minutes for unknown types
    console.log(`🔧 Fallback result for ${exerciseType}: ${result} minutes`);
    return result;
  }
  
  const grammarConfig = hasGrammar ? lessonConfig.withGrammar : lessonConfig.withoutGrammar;
  const result = grammarConfig[exerciseType as keyof typeof grammarConfig] || 3; // Minimum 3 minutes for unknown types
  
  console.log(`🔧 Found time for ${exerciseType} in ${normalizedLessonTime} ${hasGrammar ? 'with' : 'without'} grammar: ${result} minutes`);
  
  return result;
};

export const validateWorksheetTimes = (
  warmupTime: number,
  grammarTime: number, 
  exerciseTimes: number[],
  targetTime: number
): { isValid: boolean; actualTime: number; difference: number } => {
  const actualTime = warmupTime + grammarTime + exerciseTimes.reduce((sum, time) => sum + time, 0);
  const difference = Math.abs(actualTime - targetTime);
  const isValid = difference <= 1; // Allow 1 minute tolerance
  
  return { isValid, actualTime, difference };
};
