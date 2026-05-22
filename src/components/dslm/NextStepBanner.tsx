/**
 * NextStepBanner v4 — prominent #1 card.
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
import { Sparkles, Edit, Loader2, ArrowRight, ChevronDown, ClipboardCopy, MessageSquarePlus, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeConfidence } from '@/lib/dslm/confidenceScore';
import { ConfidenceBadge } from './ConfidenceBadge';

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
  generating,
  hasGoals,
}) => {
  const storageKey = `dslm.nextStep.detailsOpen.${studentId}`;
  const [detailsOpen, setDetailsOpen] = useState(false);

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
          <p className="text-muted-foreground">
            {hasGoals
              ? 'No next step yet. Generate AI-powered worksheet suggestions.'
              : 'Add goals first for better worksheet suggestions.'}
          </p>
          <Button onClick={onGenerate} disabled={generating || !hasGoals}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate next steps
          </Button>
        </CardContent>
      </Card>
    );
  }

  const focusMap: Record<string, string> = suggestion.suggested_exercise_focus_map || {};
  const exercises: string[] = suggestion.suggested_exercises || [];
  const confidence = computeConfidence({ suggestion });

  return (
    <TooltipProvider>
      <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-primary-foreground border-0 shadow-lg">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">Next Step #1</span>
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

          <div className="flex flex-wrap gap-2 pt-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" className="bg-white text-blue-700 hover:bg-white/90 h-8" onClick={() => onUseAndGenerate(suggestion)}>
                  Generate worksheet ↗
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open form pre-filled and start generating immediately</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/20 h-8" onClick={() => onUse(suggestion)}>
                  <ClipboardCopy className="h-3.5 w-3.5 mr-1" /> Use this
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy to form & edit before generating</TooltipContent>
            </Tooltip>
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-white/20 h-8" onClick={() => onEdit(suggestion)}>
              <Edit className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
            {onRegenerateWithComment && (
              <Button
                size="sm" variant="ghost"
                className="text-primary-foreground hover:bg-white/20 h-8"
                onClick={() => onRegenerateWithComment(suggestion)}
                disabled={generating}
              >
                <MessageSquarePlus className="h-3.5 w-3.5 mr-1" /> Regenerate with comment
              </Button>
            )}
            {onMarkUsed && (
              <Button
                size="sm" variant="ghost"
                className="text-primary-foreground hover:bg-white/20 h-8"
                onClick={() => onMarkUsed(suggestion.id)}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark as already used
              </Button>
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
              {suggestion.focus_skill_names?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {suggestion.focus_skill_names.slice(0, 6).map((skill: string) => (
                    <Badge key={skill} className="bg-white/20 text-primary-foreground border-0 text-[10px]">
                      {skill.replace(/^ns\.[A-C][12]\./, '').replace(/[._]/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
