/**
 * GoalsSheet: the complete goals editor (GoalsView, unchanged) in a side
 * panel: main goal editor, suggested goals, supporting/additional/achieved/
 * archived goals with their learning elements, and goal notes.
 */
import React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { GoalsView } from '@/components/dslm/GoalsView';

interface GoalsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  teacherId: string;
  studentName: string;
  englishLevel: string;
  mainGoal: string;
  mainGoalTargetDate: string | null;
  onMainGoalChange?: (newGoal: string) => void;
  onMainGoalTargetDateChange?: (date: string | null) => void;
}

export const GoalsSheet: React.FC<GoalsSheetProps> = ({ open, onOpenChange, ...goalsProps }) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
      <SheetHeader className="pr-8">
        <SheetTitle>Goals & notes</SheetTitle>
        <SheetDescription>Where the student is going. Deadlines pace the roadmap and the lesson suggestions.</SheetDescription>
      </SheetHeader>
      <div className="mt-4">
        {open ? <GoalsView {...goalsProps} listenForAddGoalEvents={false} /> : null}
      </div>
    </SheetContent>
  </Sheet>
);
