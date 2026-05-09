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
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { NextStepBanner } from './NextStepBanner';
import { CompactSuggestionCard } from './CompactSuggestionCard';
import { ScrollableStepList } from './ScrollableStepList';
import { ChevronDown, Plus, RefreshCw, Loader2, History } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
  onGenerateMore: (count: number, excludeIds: string[]) => Promise<boolean> | boolean;
  onRegenerateOne: (id: string, teacherComment: string) => Promise<boolean> | boolean;
  /** v4.8: mark suggestion as already used (no worksheet link). */
  onMarkUsed?: (id: string) => void;
  /** v4.8: history of used suggestions for the negative-numbered Used Steps section. */
  usedSteps?: any[];
  /** v5.0: restore the most recent used step back to active list. */
  onRestore?: (id: string) => void;
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
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [usedOpen, setUsedOpen] = useState(false);
  const [commentDialog, setCommentDialog] = useState<{ open: boolean; suggestion?: any }>({ open: false });
  const [comment, setComment] = useState('');
  const [moreCount, setMoreCount] = useState(3);
  // v6.9.11: count dialog for the FIRST generation (empty state) — UX parity with "Generate more".
  const [firstGenDialogOpen, setFirstGenDialogOpen] = useState(false);
  const [firstGenCount, setFirstGenCount] = useState(3);

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
        onGenerate={() => { setFirstGenCount(3); setFirstGenDialogOpen(true); }}
        onRegenerateWithComment={openCommentForOne}
        onMarkUsed={onMarkUsed}
        generating={generating}
        hasGoals={hasGoals}
      />

      {rest.length > 0 && (
        <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger asChild>
            {/* v4.6: high-contrast bar so it doesn't get lost under the blue Next Step #1 banner. */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-900 dark:bg-blue-950/40 dark:hover:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800 shadow-sm"
            >
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">
                  {moreOpen ? 'Hide' : 'Show'} {rest.length} more next step{rest.length > 1 ? 's' : ''}
                </span>
                <span className="text-[10px] opacity-80 font-normal">
                  Queued recommendations beyond the top priority step
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary" className="bg-blue-200 text-blue-900 dark:bg-blue-800 dark:text-blue-100 text-[10px]">
                  {rest.length}
                </Badge>
                <ChevronDown className={cn('h-4 w-4 transition-transform', moreOpen && 'rotate-180')} />
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

      {/* Toolbar: only "Generate more" — regenerate-all removed */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Generate more next steps
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72 p-2 space-y-2">
              <DropdownMenuLabel className="text-xs">How many next steps to add?</DropdownMenuLabel>
              <Input
                type="number" min="1" max="6" value={moreCount}
                onChange={(e) => setMoreCount(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
                className="h-8"
              />
              <p className="text-[11px] text-muted-foreground leading-snug">
                {currentPhaseLabel ? (
                  <>Will generate for: <strong className="text-foreground">{currentPhaseLabel}</strong>.
                  To target a different phase, use the phase's own generate button.</>
                ) : (
                  <>No phase active. New steps will be free-floating. Tip: start a curriculum phase to focus next steps on it.</>
                )}
              </p>
              <Button
                size="sm" className="w-full"
                onClick={() => onGenerateMore(moreCount, allIds)}
                disabled={generating}
              >
                Add {moreCount} next step{moreCount > 1 ? 's' : ''}
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* v6.9.11: First-generation count dialog (empty state). */}
      <Dialog open={firstGenDialogOpen} onOpenChange={setFirstGenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate next steps</DialogTitle>
            <DialogDescription>
              How many AI-generated next steps should we create for this student?
              {currentPhaseLabel ? <> They will be bound to <strong>{currentPhaseLabel}</strong>.</> : null}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              type="number" min="1" max="6" value={firstGenCount}
              onChange={(e) => setFirstGenCount(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground leading-snug">
              Recommended: 3 (rolling 3-lesson plan). For phase-bound steps, the recommendation matches the phase length (1 step ≈ 1 week).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFirstGenDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => { setFirstGenDialogOpen(false); await onGenerateMore(firstGenCount, []); }}
              disabled={generating}
            >
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Generate {firstGenCount} step{firstGenCount > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
