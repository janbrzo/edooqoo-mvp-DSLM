/**
 * CompactSuggestionCard — shared compact card for Next Steps and Phase steps.
 * v4.2: Whole header is click-to-expand (entire title row toggles open/close).
 * Toolbar buttons are siblings (NOT children of the trigger), so they don't toggle.
 */
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, Play, Edit, Trash2, ClipboardCopy, MessageSquarePlus, CheckCircle2, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeConfidence } from '@/lib/dslm/confidenceScore';
import { ConfidenceBadge } from './ConfidenceBadge';

interface CompactSuggestionCardProps {
  s: any;
  /** Stable display index, e.g. 1, 2, 3 (used > 0). Pass negative for "used" items. */
  displayIndex: number;
  phaseLabel?: string | null;
  onUseAndGenerate: (s: any) => void;
  onUse: (s: any) => void;
  onEdit: (s: any) => void;
  onDelete: (id: string) => void;
  onRegenerateWithComment: (s: any) => void;
  /** v4.8: optional "Mark as already used" flow. */
  onMarkUsed?: (id: string) => void;
  /** v4.8: render a read-only used-step variant (greyed, no Use/Generate buttons). */
  isUsed?: boolean;
  /** v5.0: restore a used step back to active list (only on the newest used). */
  onRestore?: (id: string) => void;
}

export const CompactSuggestionCard: React.FC<CompactSuggestionCardProps> = ({
  s, displayIndex, phaseLabel,
  onUseAndGenerate, onUse, onEdit, onDelete, onRegenerateWithComment,
  onMarkUsed, isUsed = false, onRestore,
}) => {
  const [open, setOpen] = useState(false);
  const focusMap: Record<string, string> = s.suggested_exercise_focus_map || {};
  const exercises: string[] = s.suggested_exercises || [];
  const indexLabel = displayIndex < 0 ? `${displayIndex}` : `#${displayIndex}`;
  const confidence = computeConfidence({ suggestion: s });

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn('border-dashed', isUsed && 'opacity-60 grayscale-[20%]')}>
        <CardContent className="p-2.5">
          <div className="flex items-center gap-2">
            {/* Click-to-expand trigger covers number + title area */}
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors"
                aria-label={open ? 'Collapse details' : 'Expand details'}
              >
                <div className="flex items-center justify-center h-6 min-w-[28px] px-1 rounded-full bg-muted text-[10px] font-bold text-muted-foreground shrink-0">
                  {indexLabel}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm font-medium truncate">{s.suggested_topic}</p>
                    {phaseLabel && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">{phaseLabel}</Badge>
                    )}
                    {isUsed && (
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 shrink-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        used
                      </Badge>
                    )}
                    {/* Confidence renders OUTSIDE the collapsible trigger — see toolbar below */}
                  </div>
                  {s.suggested_grammar_focus && (
                    <p className="text-[11px] text-primary truncate">{s.suggested_grammar_focus}</p>
                  )}
                </div>
              </button>
            </CollapsibleTrigger>

            {/* Toolbar — NOT inside the trigger, so clicks here don't toggle */}
            <div className="flex items-center gap-0.5 shrink-0">
              <ConfidenceBadge
                score={confidence.score}
                label={confidence.label}
                reasons={confidence.reasons}
                className="mr-1"
              />
              {!isUsed && <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onUseAndGenerate(s)}>
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Generate worksheet (auto-start)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onUse(s)}>
                      <ClipboardCopy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Use this (copy to form, edit before generating)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(s)}>
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRegenerateWithComment(s)}>
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Regenerate with comment</TooltipContent>
                </Tooltip>
                {onMarkUsed && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700" onClick={() => onMarkUsed(s.id)}>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mark as already used</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDelete(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Remove</TooltipContent>
                </Tooltip>
              </TooltipProvider>}
              {isUsed && onRestore && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] px-2 gap-1 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/40"
                        onClick={() => onRestore(s.id)}
                      >
                        <Undo2 className="h-3 w-3" /> Restore
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Restore to active list (in case marked by mistake)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <CollapsibleTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Toggle details">
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          <CollapsibleContent className="pt-2 ml-9 space-y-1.5">
            {isUsed && s.used_at && (
              <p className="text-[10px] text-muted-foreground">
                Used {new Date(s.used_at).toLocaleDateString()}
                {s.used_worksheet_id ? '' : ' (marked manually)'}
              </p>
            )}
            {s.suggested_goal && <p className="text-xs text-muted-foreground">{s.suggested_goal}</p>}
            {exercises.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {exercises.map((ex, i) => {
                  const focus = focusMap[ex];
                  const tag =
                    focus === 'vocabulary' ? <span className="ml-1 text-blue-600 dark:text-blue-400 font-bold">[V]</span>
                    : focus === 'grammar'   ? <span className="ml-1 text-purple-600 dark:text-purple-400 font-bold">[G]</span>
                    :                          <span className="ml-1 text-muted-foreground font-semibold">[–]</span>;
                  return (
                    <Badge key={`${ex}-${i}`} variant="secondary" className="text-[10px]">
                      {ex}
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            )}
            {s.rationale && <p className="text-xs text-muted-foreground italic">{s.rationale}</p>}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
};
