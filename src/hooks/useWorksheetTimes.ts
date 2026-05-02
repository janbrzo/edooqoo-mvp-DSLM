
import { useMemo } from 'react';
import { calculateWorksheetTimes, WorksheetTimes } from '@/utils/timeCalculator';

export const useWorksheetTimes = (lessonTime?: string, hasGrammar: boolean = true): WorksheetTimes => {
  return useMemo(() => {
    if (!lessonTime) {
      return calculateWorksheetTimes('45min', hasGrammar); // Default fallback
    }
    return calculateWorksheetTimes(lessonTime, hasGrammar);
  }, [lessonTime, hasGrammar]);
};
