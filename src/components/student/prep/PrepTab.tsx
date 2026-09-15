/**
 * PrepTab — composition of the Prep tab (v6.9.111, M4 step 3).
 *
 * Pure composition: it stacks the banners slot, NextLessonCard, LastLessonStrip
 * and QuickNoteBox. It owns no data fetching, no sessionStorage and no
 * navigation — `StudentPage.tsx` passes everything down as props (M4 step 4).
 */

import React from 'react';
import { NextLessonCard } from '@/components/student/prep/NextLessonCard';
import {
  LastLessonStrip,
  type LastLessonWorksheet,
} from '@/components/student/prep/LastLessonStrip';
import { QuickNoteBox } from '@/components/student/prep/QuickNoteBox';
import type { PrepSuggestion } from '@/lib/students/prepPlan';
import type { StudentKnowledgeEntry } from '@/types/studentKnowledge';

export interface PrepTabProps {
  /** Banners rendered above the prep stack (welcome test, student hub, intake). */
  banners?: React.ReactNode;

  // Next lesson
  studentName: string;
  nextLessonLabel: string | null;
  isLessonLoading: boolean;
  suggestion: PrepSuggestion;
  rationale: string;
  focusAreas: readonly string[];
  isSuggestionsLoading: boolean;
  onGenerate: () => void;
  onChangeTopic: () => void;
  onOpenModel: () => void;

  // Last lesson
  lastWorksheet: LastLessonWorksheet | null;
  isWorksheetLoading: boolean;
  onReuse: (worksheetId: string) => void;
  onOpenLibrary: () => void;

  // Quick note
  recentNotes: readonly StudentKnowledgeEntry[];
  isNotesLoading: boolean;
  isNoteSaving: boolean;
  onSaveNote: (content: string) => Promise<void>;
  onExpandNote: () => void;
  onViewAllNotes: () => void;
}

export const PrepTab: React.FC<PrepTabProps> = ({
  banners,
  studentName,
  nextLessonLabel,
  isLessonLoading,
  suggestion,
  rationale,
  focusAreas,
  isSuggestionsLoading,
  onGenerate,
  onChangeTopic,
  onOpenModel,
  lastWorksheet,
  isWorksheetLoading,
  onReuse,
  onOpenLibrary,
  recentNotes,
  isNotesLoading,
  isNoteSaving,
  onSaveNote,
  onExpandNote,
  onViewAllNotes,
}) => {
  return (
    <div className="space-y-4" data-testid="student-prep-tab">
      {banners}

      <NextLessonCard
        studentName={studentName}
        nextLessonLabel={nextLessonLabel}
        isLessonLoading={isLessonLoading}
        suggestion={suggestion}
        rationale={rationale}
        focusAreas={focusAreas}
        isSuggestionsLoading={isSuggestionsLoading}
        onGenerate={onGenerate}
        onChangeTopic={onChangeTopic}
        onOpenModel={onOpenModel}
      />

      <LastLessonStrip
        worksheet={lastWorksheet}
        isLoading={isWorksheetLoading}
        onReuse={onReuse}
        onOpenLibrary={onOpenLibrary}
      />

      <QuickNoteBox
        recentNotes={recentNotes}
        isLoading={isNotesLoading}
        isSaving={isNoteSaving}
        onSave={onSaveNote}
        onExpand={onExpandNote}
        onViewAll={onViewAllNotes}
      />
    </div>
  );
};

export default PrepTab;
