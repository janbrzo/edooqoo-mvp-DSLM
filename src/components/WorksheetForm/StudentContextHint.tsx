import React from 'react';
import { Info, Sparkles } from 'lucide-react';

/**
 * v6.9.15a — Contextual info box for the student selector area on WorksheetForm.
 * Variants:
 *  - "no-students"   → teacher has zero students
 *  - "no-selection"  → teacher has students but selected "no-student"
 *  - "no-next-steps" → a student is selected but has no pending Next Steps
 */
export type StudentContextHintVariant = 'no-students' | 'no-selection' | 'no-next-steps';

interface StudentContextHintProps {
  variant: StudentContextHintVariant;
  studentId?: string | null;
}

export const StudentContextHint: React.FC<StudentContextHintProps> = ({ variant, studentId }) => {
  const base = 'w-full mt-2 flex items-start gap-2 px-3 py-2 rounded-md border text-xs leading-snug';
  const amber = 'border-amber-300 bg-amber-50/60 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200';
  const blue = 'border-primary/30 bg-primary/5 text-foreground';

  if (variant === 'no-students') {
    return (
      <div className={`${base} ${amber}`}>
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          Worksheets without a student are <strong>generic</strong>. Add your first student to unlock personalized goals, level matching, and AI Next Steps.
        </span>
      </div>
    );
  }

  if (variant === 'no-selection') {
    return (
      <div className={`${base} ${amber}`}>
        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          You have students but none is selected. Pick one above to personalize the worksheet to their level, goals, and pacing.
        </span>
      </div>
    );
  }

  // no-next-steps
  return (
    <div className={`${base} ${blue}`}>
      <Sparkles className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
      <span className="flex-1">
        This student has no Next Steps yet. Open their Pathway to generate AI-recommended next worksheets, or continue with manual setup below.
      </span>
      {studentId && (
        <a
          href={`/student/${studentId}`}
          className="ml-2 font-medium text-primary hover:underline whitespace-nowrap"
        >
          Open Pathway →
        </a>
      )}
    </div>
  );
};