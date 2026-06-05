/**
 * NextStepBanner v4 — prominent #1 suggestion card.
 * Buttons:
 *  - "Generate worksheet ↗" → onUseAndGenerate (auto-start generation)
 *  - "Use this" → onUse (prefill only)
 *  - Edit / Regenerate with comment
 */
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Edit, Loader2, ArrowRight, ChevronDown, ClipboardCopy, MessageSquarePlus, CheckCircle2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeConfidence } from '@/lib/dslm/confidenceScore';
import { ConfidenceBadge } from './ConfidenceBadge';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';

const formatSkillLabel = (skill: string) =>
  skill.replace(/^ns\.[A-C][12]\./, '').replace(/^ns\./, '').replace(/[._]/g, ' ');

const toCount = (value: unknown) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

interface NextStepBannerProps {
  suggestion: any | null;
  studentId: string;
  onUse: (suggestion: any) => void;
  onUseAndGenerate: (suggestion: any) => void;
  onEdit: (suggestion: any) => void;
  onSkip?: (suggestionId: string) => void;
  onGenerate: () => void;
  onRegenerateWithComment?: (suggestion: any) => void;
  /** v4.8: mark this suggestion as already used (manual flag, no worksheet link). */
  onMarkUsed?: (suggestionId: string) => void;
  /** v6.9.14 — delete the #1 next step (with type-to-confirm). */
  onDelete?: (suggestionId: string) => void;
  generating: boolean;
  hasGoals: boolean;
}

export const NextStepBanner: React.FC<NextStepBannerProps> = ({
  suggestion,
  studentId,
  onUse,
  onUseAndGenerate,
  onEdit,
  onGenerate,
  onRegenerateWithComment,
  onMarkUsed,
  onDelete,
  generating,
  hasGoals,
}) => {
  const storageKey = `dslm.nextStep.detailsOpen.${studentId}`;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) setDetailsOpen(stored === '1');
    } catch { /* ignore */ }
  }, [storageKey]);

  const handleToggleDetails = (open: boolean) => {
    setDetailsOpen(open);
    try { localStorage.setItem(storageKey, open ? '1' : '0'); } catch { /* ignore */ }
  };

  if (!suggestion) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="pt-6 text-center space-y-3">
          <div className="space-y-1">
            <p className="text-muted-foreground">
              {hasGoals
                ? 'No 1-Minute Prep suggestion yet. Generate AI-powered worksheet suggestions.'
                : 'Add goals first for better 1-Minute Prep suggestions.'}
            </p>
            {!hasGoals && (
              <p className="text-[11px] opacity-70">
                Just added some? Refresh the page to see them.
              </p>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={onGenerate} disabled={generating || !hasGoals}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate 1-Minute Prep suggestions
            </Button>
            {!hasGoals && (
              <Button variant="ghost" size="sm" onClick={() => window.location.reload()}>
                Refresh
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const focusMap: Record<string, string> = suggestion.suggested_exercise_focus_map || {};
  const exercises: string[] = suggestion.suggested_exercises || [];
  const confidence = computeConfidence({ suggestion });
  const generationContext = suggestion.generation_context || {};
  const focusSkills: string[] = Array.isArray(suggestion.focus_skill_names) ? suggestion.focus_skill_names : [];
  const contextStats = [
    { label: 'Skill metrics', value: toCount(generationContext.metrics_count) },
    { label: 'Goals', value: toCount(generationContext.goals_count) },
    { label: 'Knowledge notes', value: toCount(generationContext.knowledge_count) },
    { label: 'Existing steps', value: toCount(generationContext.existing_steps_count) },
  ];
  const impactEntries = suggestion.estimated_impact && typeof suggestion.estimated_impact === 'object'
    ? Object.entries(suggestion.estimated_impact).slice(0, 4)
    : [];

  return (
    <TooltipProvider>
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-primary-foreground border-0 shadow-lg">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">1-Minute Prep suggestion #1</span>
              <ConfidenceBadge
                score={confidence.score}
                label={confidence.label}
                reasons={confidence.reasons}
                variant="inverse"
              />
            </div>
            {suggestion.difficulty_level && (
              <Badge variant="secondary" className="bg-white/20 text-primary-foreground border-0 text-[10px]">
                {suggestion.difficulty_level}
              </Badge>
            )}
          </div>

          <h3 className="text-base sm:text-lg font-bold leading-tight">{suggestion.suggested_topic}</h3>

          {suggestion.suggested_goal && (
            <p className="text-xs sm:text-sm opacity-90 line-clamp-2">{suggestion.suggested_goal}</p>
          )}

          {/* Exercise chips with V/G tags */}
          {exercises.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {exercises.map((ex, i) => {
                const focus = focusMap[ex];
                const tag =
                  focus === 'vocabulary' ? <span className="ml-1 text-blue-200 font-bold">[V]</span>
                  : focus === 'grammar'   ? <span className="ml-1 text-purple-200 font-bold">[G]</span>
                  :                          <span className="ml-1 opacity-60 font-semibold">[–]</span>;
                return (
                  <Badge key={`${ex}-${i}`} className="bg-white/15 text-primary-foreground border-0 text-[10px] hover:bg-white/20">
                    {ex}
                    {tag}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* v6.9.15a — single-row action bar; secondary actions shrink to icon+short label, full text in tooltips. */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 pt-1 sm:overflow-x-auto">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" className="bg-white text-blue-700 hover:bg-white/90 h-8 shrink-0" onClick={() => onUseAndGenerate(suggestion)}>
                  Generate worksheet ↗
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open form pre-filled and start generating immediately</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/20 h-8 px-2 shrink-0" onClick={() => onUse(suggestion)}>
                  <ClipboardCopy className="h-3.5 w-3.5 mr-1" /> Use this
                </Button>
              </TooltipTrigger>
              <TooltipContent>Use this — copy to form &amp; edit before generating</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/20 h-8 px-2 shrink-0" onClick={() => onEdit(suggestion)}>
                  <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit suggestion details</TooltipContent>
            </Tooltip>
            {onRegenerateWithComment && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm" variant="ghost"
                    className="text-primary-foreground hover:bg-white/20 h-8 px-2 shrink-0"
                    onClick={() => onRegenerateWithComment(suggestion)}
                    disabled={generating}
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> Regenerate with comment
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Regenerate with comment</TooltipContent>
              </Tooltip>
            )}
            {onMarkUsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm" variant="ghost"
                    className="text-primary-foreground hover:bg-white/20 h-8 px-2 shrink-0"
                    onClick={() => onMarkUsed(suggestion.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Used
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mark as already used</TooltipContent>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon" variant="ghost"
                    className="text-primary-foreground hover:bg-white/20 h-8 w-8 shrink-0"
                    onClick={() => setConfirmDeleteOpen(true)}
                    aria-label="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove</TooltipContent>
              </Tooltip>
            )}
          </div>

          <Collapsible open={detailsOpen} onOpenChange={handleToggleDetails}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1 text-[11px] opacity-80 hover:opacity-100 transition-opacity mt-1">
                <ChevronDown className={cn('h-3 w-3 transition-transform', detailsOpen && 'rotate-180')} />
                {detailsOpen ? 'Hide details' : 'Show details'}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {suggestion.suggested_grammar_focus && (
                <p className="text-xs opacity-90">
                  <span className="font-semibold">Grammar:</span> {suggestion.suggested_grammar_focus}
                </p>
              )}
              {suggestion.rationale && (
                <p className="text-xs opacity-80 italic">{suggestion.rationale}</p>
              )}
              <div className="rounded-md border border-white/20 bg-white/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Why this suggestion</p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {contextStats.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded bg-white/10 px-2 py-1 text-[11px]">
                      <span className="opacity-80">{item.label}</span>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                  {generationContext.pacing_label && (
                    <div className="flex items-center justify-between rounded bg-white/10 px-2 py-1 text-[11px]">
                      <span className="opacity-80">Pacing</span>
                      <span className="font-semibold">{generationContext.pacing_label}</span>
                    </div>
                  )}
                  {suggestion.difficulty_level && (
                    <div className="flex items-center justify-between rounded bg-white/10 px-2 py-1 text-[11px]">
                      <span className="opacity-80">Difficulty</span>
                      <span className="font-semibold">{suggestion.difficulty_level}</span>
                    </div>
                  )}
                </div>
                {confidence.reasons.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {confidence.reasons.map((reason) => (
                      <Badge key={reason} className="bg-white/15 text-primary-foreground border-0 text-[10px]">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                )}
                {impactEntries.length > 0 && (
                  <p className="mt-2 text-[11px] opacity-80">
                    Expected: {impactEntries.map(([key, value]) => `${key} ${String(value)}`).join(', ')}
                  </p>
                )}
              </div>
              {focusSkills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {focusSkills.slice(0, 6).map((skill: string) => (
                    <Badge key={skill} className="bg-white/20 text-primary-foreground border-0 text-[10px]">
                      {formatSkillLabel(skill)}
                    </Badge>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      {onDelete && (
        <ConfirmDeleteDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          label="1-Minute Prep suggestion #1"
          description="This will remove the top-priority suggestion. You can regenerate later."
          onConfirm={() => onDelete(suggestion.id)}
        />
      )}
    </TooltipProvider>
  );
};
