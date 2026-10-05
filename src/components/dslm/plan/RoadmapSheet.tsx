/**
 * RoadmapSheet — the full roadmap editor, one click away from the Plan.
 * MacroTimeline is mounted unchanged (every phase action, dialog and
 * regeneration flow), together with the two settings that steer how lessons
 * are proposed: "use roadmap" and pacing.
 */
import React from 'react';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { MacroTimeline } from '@/components/dslm/MacroTimeline';
import { PacingModeSlider } from '@/components/dslm/PacingModeSlider';
import type { PlanSuggestion } from './UpNextSection';

interface RoadmapSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPhaseId: string | null;
  studentId: string;
  teacherId: string;
  useRoadmap: boolean;
  onUseRoadmapChange?: (next: boolean) => void;
  pacingMode: number;
  onPacingModeChange?: (next: number) => void;
  phaseSteps: readonly PlanSuggestion[];
  displayIndexById: Record<string, number>;
  generatingSteps: boolean;
  onUseSuggestion: (s: PlanSuggestion) => void;
  onUseAndGenerate: (s: PlanSuggestion) => void;
  onEditSuggestion: (s: PlanSuggestion) => void;
  onDeleteSuggestion: (id: string) => void;
  onMarkUsed: (id: string) => void;
  onRegenerateOne: (id: string, comment: string) => Promise<boolean> | boolean;
  onGenerateForPhase: (phaseId: string, count: number, comment: string) => Promise<boolean> | boolean;
}

export const RoadmapSheet: React.FC<RoadmapSheetProps> = ({
  open,
  onOpenChange,
  initialPhaseId,
  studentId,
  teacherId,
  useRoadmap,
  onUseRoadmapChange,
  pacingMode,
  onPacingModeChange,
  phaseSteps,
  displayIndexById,
  generatingSteps,
  onUseSuggestion,
  onUseAndGenerate,
  onEditSuggestion,
  onDeleteSuggestion,
  onMarkUsed,
  onRegenerateOne,
  onGenerateForPhase,
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-2xl">
      <SheetHeader className="pr-8">
        <SheetTitle>Roadmap</SheetTitle>
        <SheetDescription>
          Phases from today to the goal. New lesson suggestions follow the phase in progress.
        </SheetDescription>
      </SheetHeader>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        {onUseRoadmapChange ? (
          <div className="flex items-center gap-2">
            <Switch id="plan-use-roadmap" checked={useRoadmap} onCheckedChange={onUseRoadmapChange} />
            <Label htmlFor="plan-use-roadmap" className="cursor-pointer text-sm">
              Use roadmap when proposing lessons
            </Label>
          </div>
        ) : <span />}
        {onPacingModeChange ? (
          <PacingModeSlider value={pacingMode} onChange={onPacingModeChange} studentId={studentId} teacherId={teacherId} />
        ) : null}
      </div>
      <div className="mt-4">
        {open ? (
          <MacroTimeline
            key={initialPhaseId ?? 'roadmap'}
            studentId={studentId}
            teacherId={teacherId}
            suggestions={[...phaseSteps]}
            displayIndexById={displayIndexById}
            generatingSteps={generatingSteps}
            onUseSuggestion={onUseSuggestion}
            onUseAndGenerate={onUseAndGenerate}
            onEditSuggestion={onEditSuggestion}
            onDeleteSuggestion={onDeleteSuggestion}
            onMarkUsed={onMarkUsed}
            onRegenerateOne={onRegenerateOne}
            onGenerateForPhase={onGenerateForPhase}
            initialExpandedPhaseId={initialPhaseId}
          />
        ) : null}
      </div>
    </SheetContent>
  </Sheet>
);
