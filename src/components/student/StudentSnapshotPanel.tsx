/**
 * StudentSnapshotPanel — the "who is this student" summary of the Student
 * Workspace (v6.9.111, M3.2).
 *
 * Presentational only. Every rule (focus-area selection, deadline formatting,
 * hub status) lives in `src/lib/students/studentSnapshot.ts`.
 *
 * One file renders both variants: a sticky desktop `<aside>` and a collapsed-by-
 * default mobile `Collapsible`, so the legacy tab strip stays above the fold.
 */

import React, { useState } from 'react';
import { ChevronDown, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatGoal } from '@/lib/students/formatGoal';
import { describeHubStatus, formatDeadline } from '@/lib/students/studentSnapshot';

export interface StudentSnapshotPanelProps {
  englishLevel: string | null;
  mainGoal: string | null;
  mainGoalTargetDate: string | null;
  focusAreas: string[];
  hubEmail: string | null;
  onOpenModel: () => void;
}

const NOT_SET = 'Not set';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-0.5">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <div className="text-sm text-foreground">{children}</div>
  </div>
);

function buildSnapshotContent({
  englishLevel,
  mainGoal,
  mainGoalTargetDate,
  focusAreas,
  hubEmail,
  onOpenModel,
}: StudentSnapshotPanelProps) {
  const goalLabel = formatGoal(mainGoal) || NOT_SET;
  const deadline = formatDeadline(mainGoalTargetDate) ?? NOT_SET;
  const hub = describeHubStatus(hubEmail);

  return (
    <div className="space-y-4">
      <Row label="Level">{englishLevel || NOT_SET}</Row>
      <Row label="Goal">
        <span className="break-words">{goalLabel}</span>
      </Row>
      <Row label="Deadline">{deadline}</Row>
      <Row label="Focus areas">
        {focusAreas.length === 0 ? (
          <span className="text-muted-foreground">No focus areas yet</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {focusAreas.map((area) => (
              <Badge key={area} variant="outline" className="max-w-full font-normal">
                <span className="truncate">{area}</span>
              </Badge>
            ))}
          </div>
        )}
      </Row>
      <Row label="Student Hub">
        <span className={hub.enabled ? 'text-foreground' : 'text-muted-foreground'}>
          {hub.label}
        </span>
        {hub.email && (
          <span className="block truncate text-xs text-muted-foreground" title={hub.email}>
            {hub.email}
          </span>
        )}
      </Row>
      <Button variant="ghost" size="sm" className="w-full justify-start px-2" onClick={onOpenModel}>
        <GraduationCap className="mr-2 h-4 w-4" />
        Open learning model
      </Button>
    </div>
  );
}

export const StudentSnapshotPanel: React.FC<StudentSnapshotPanelProps> = (props) => {
  const [open, setOpen] = useState(false);
  const content = buildSnapshotContent(props);
  const summary = [props.englishLevel || NOT_SET, formatGoal(props.mainGoal) || NOT_SET]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      {/* Desktop */}
      <aside
        aria-label="Student snapshot"
        className="hidden lg:block lg:sticky lg:top-20 lg:self-start lg:border-l lg:border-border lg:pl-6"
      >
        {content}
      </aside>

      {/* Mobile */}
      <Collapsible open={open} onOpenChange={setOpen} className="lg:hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">Student snapshot</span>
              <span className="block truncate text-xs text-muted-foreground">{summary}</span>
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3 pt-3">{content}</CollapsibleContent>
      </Collapsible>
    </>
  );
};

export default StudentSnapshotPanel;
