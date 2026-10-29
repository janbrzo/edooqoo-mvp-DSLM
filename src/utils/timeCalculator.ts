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

// The per-type time table lives in one shared module (also used by the Edge Function).
export { getExerciseTimeByType } from '../../supabase/functions/_shared/exerciseTime';

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
