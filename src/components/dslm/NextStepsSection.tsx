/**
 * NextStepsSection — DSLM Pathway v4.1
 * Shows: prominent banner (#1) + collapsible compact list (#2..N) using shared
 * CompactSuggestionCard. Numbering uses stable displayIndex (computed by parent).
 * Toolbar: [+ Generate more next steps] (with phase info).
 * "Regenerate all steps" REMOVED — only per-step regeneration via comment dialog.
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { NextStepBanner } from './NextStepBanner';
import { CompactSuggestionCard } from './CompactSuggestionCard';
import { ScrollableStepList } from './ScrollableStepList';
import { ChevronDown, Plus, RefreshCw, Loader2, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GenerateStepsDialog, type PhaseOption } from './GenerateStepsDialog';

interface DisplayItem {
  s: any;
  displayIndex: number;
  phaseLabel?: string | null;
}

interface NextStepsSectionProps {
  /** Items to display, in order, with precomputed displayIndex + phaseLabel. */
  items: DisplayItem[];
  studentId: string;
  generating: boolean;
  hasGoals: boolean;
  /** Header label like "Phase 1: Refining grammar" when an in_progress phase exists. */
  currentPhaseLabel?: string | null;
  onUseAndGenerate: (s: any) => void;
  onUse: (s: any) => void;
  onEdit: (s: any) => void;
  onDelete: (id: string) => void;
  onGenerateMore: (count: number, excludeIds: string[], phaseId: string | null) => Promise<boolean> | boolean;
  onRegenerateOne: (id: string, teacherComment: string) => Promise<boolean> | boolean;
  /** v4.8: mark suggestion as already used (no worksheet link). */
  onMarkUsed?: (id: string) => void;
  /** v4.8: history of used suggestions for the negative-numbered Used Steps section. */
  usedSteps?: any[];
  /** v5.0: restore the most recent used step back to active list. */
  onRestore?: (id: string) => void;
  /** v6.9.13 — phase metadata for the shared GenerateStepsDialog. */
  phaseOptions?: PhaseOption[];
  /** v6.9.13 — recommended target phase id (null = free). */
  defaultTargetPhaseId?: string | null;
  /** v6.9.13 — when false, hide phase selector (roadmap disabled). */
  showPhaseSelector?: boolean;
}

export const NextStepsSection: React.FC<NextStepsSectionProps> = ({
  items,
  studentId,
  generating,
  hasGoals,
  currentPhaseLabel,
  onUseAndGenerate,
  onUse,
  onEdit,
  onDelete,
  onGenerateMore,
  onRegenerateOne,
  onMarkUsed,
  usedSteps = [],
  onRestore,
  phaseOptions = [],
  defaultTargetPhaseId = null,
  showPhaseSelector = true,
}) => {
  const [moreListOpen, setMoreListOpen] = useState(false);
  const [usedOpen, setUsedOpen] = useState(false);
  const [commentDialog, setCommentDialog] = useState<{ open: boolean; suggestion?: any }>({ open: false });
  const [comment, setComment] = useState('');
  // v6.9.13 — unified shared dialog for both first/more flows.
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [genMode, setGenMode] = useState<'first' | 'more'>('first');

  const allIds = items.map(it => it.s.id);
  const first = items[0] || null;
  const rest = items.slice(1);

  const openCommentForOne = (s: any) => {
    setComment('');
    setCommentDialog({ open: true, suggestion: s });
  };
  const submitComment = async () => {
    const trimmed = comment.trim();
    const target = commentDialog.suggestion;
    setCommentDialog({ open: false });
    if (target) await onRegenerateOne(target.id, trimmed);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Next Steps {items.length > 0 && `(${items.length})`}
        </h3>
        {currentPhaseLabel && (
          <Badge variant="secondary" className="text-[10px]">{currentPhaseLabel}</Badge>
        )}
      </div>

      <NextStepBanner
        suggestion={first?.s ?? null}
        studentId={studentId}
        onUse={onUse}
        onUseAndGenerate={onUseAndGenerate}
        onEdit={onEdit}
        onGenerate={() => { setGenMode('first'); setGenDialogOpen(true); }}
        onRegenerateWithComment={openCommentForOne}
        onMarkUsed={onMarkUsed}
        onDelete={onDelete}
        generating={generating}
        hasGoals={hasGoals}
      />

      {rest.length > 0 && (
        <Collapsible open={moreListOpen} onOpenChange={setMoreListOpen}>
          <CollapsibleTrigger asChild>
            {/* v4.6: high-contrast bar so it doesn't get lost under the blue Next Step #1 banner. */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800 shadow-sm"
            >
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">
                  {moreListOpen ? 'Hide' : 'Show'} {rest.length} more next step{rest.length > 1 ? 's' : ''}
                </span>
                <span className="text-[10px] opacity-80 font-normal">
                  Queued recommendations beyond the top priority step
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100 text-[10px]">
                  {rest.length}
                </Badge>
                <ChevronDown className={cn('h-4 w-4 transition-transform', moreListOpen && 'rotate-180')} />
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <ScrollableStepList count={rest.length}>
              {rest.map((it) => (
                <CompactSuggestionCard
                  key={it.s.id}
                  s={it.s}
                  displayIndex={it.displayIndex}
                  phaseLabel={it.phaseLabel ?? null}
                  onUseAndGenerate={onUseAndGenerate}
                  onUse={onUse}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRegenerateWithComment={openCommentForOne}
                  onMarkUsed={onMarkUsed}
                />
              ))}
            </ScrollableStepList>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Toolbar: only "Generate more" — opens shared dialog with phase selector */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            variant="outline" size="sm" disabled={generating}
            onClick={() => { setGenMode('more'); setGenDialogOpen(true); }}
          >
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Generate more next steps
          </Button>
        </div>
      )}

      {/* Per-step regenerate-with-comment dialog */}
      <Dialog open={commentDialog.open} onOpenChange={(open) => !open && setCommentDialog({ open: false })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate this next step</DialogTitle>
            <DialogDescription>
              Tell the AI what to change. Leave empty to regenerate with default logic. Only this single step will be replaced.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="e.g., Focus more on speaking practice for negotiations. Avoid grammar drills."
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCommentDialog({ open: false })}>Cancel</Button>
            <Button onClick={submitComment} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* v6.9.13 — unified Generate Steps dialog (first or more). */}
      <GenerateStepsDialog
        open={genDialogOpen}
        onOpenChange={setGenDialogOpen}
        mode={genMode}
        defaultCount={3}
        defaultTargetPhaseId={defaultTargetPhaseId}
        phaseOptions={phaseOptions}
        showPhaseSelector={showPhaseSelector}
        generating={generating}
        onConfirm={async (count, phaseId) => {
          if (genMode === 'first') {
            await onGenerateMore(count, [], phaseId);
          } else {
            await onGenerateMore(count, allIds, phaseId);
          }
        }}
      />

      {/* v4.8: Used Steps history (negative-numbered) */}
      {usedSteps.length > 0 && (
        <Collapsible open={usedOpen} onOpenChange={setUsedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
              <span className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Used Steps ({usedSteps.length})
              </span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', usedOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <p className="text-[10px] text-muted-foreground px-2 pb-1">
              Newest used = <span className="font-mono">−1</span>, oldest = <span className="font-mono">−{usedSteps.length}</span>. Sorted by date used. Restore is available only for the most recent (−1).
            </p>
            <ScrollableStepList count={usedSteps.length}>
              {usedSteps.map((s, idx) => (
                <CompactSuggestionCard
                  key={s.id}
                  s={s}
                  displayIndex={-(idx + 1)}
                  phaseLabel={null}
                  isUsed
                  onUseAndGenerate={() => {}}
                  onUse={() => {}}
                  onEdit={() => {}}
                  onDelete={onDelete}
                  onRegenerateWithComment={() => {}}
                  onRestore={idx === 0 ? onRestore : undefined}
                />
              ))}
            </ScrollableStepList>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};
