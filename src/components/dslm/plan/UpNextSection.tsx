/**
 * UpNextSection — the lesson queue of the Learning plan.
 *
 * #1 is a card with one primary action ("Generate worksheet"); it is the same
 * suggestion Prep shows (both read `orderUpNext`). #2…N are rows with a single
 * `…` menu and one level of in-place detail. Used suggestions live in History.
 */
import React, { useEffect, useState } from 'react';
import { ChevronDown, History, Loader2, Plus, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatPhaseCaption, type UpNextItem } from '@/lib/dslm/learningPlan';
import { formatRelativeAge } from '@/lib/students/prepPlan';
import { PlanSection } from './PlanSection';
import { SuggestionActionsMenu } from './SuggestionActionsMenu';
import { SuggestionWhyPanel, type SuggestionLike } from './SuggestionWhyPanel';

export interface PlanSuggestion extends SuggestionLike {
  id: string;
  sequence_number: number;
  phase_id?: string | null;
  is_used?: boolean | null;
  deleted_at?: string | null;
  used_at?: string | null;
  used_worksheet_id?: string | null;
}

export interface UpNextActions {
  onGenerate: (s: PlanSuggestion) => void;
  onFillForm: (s: PlanSuggestion) => void;
  onEdit: (s: PlanSuggestion) => void;
  onRegenerate: (s: PlanSuggestion) => void;
  onMarkTaught: (s: PlanSuggestion) => void;
  onRemove: (s: PlanSuggestion) => void;
}

interface UpNextSectionProps extends UpNextActions {
  studentId: string;
  items: readonly UpNextItem<PlanSuggestion>[];
  usedSteps: readonly PlanSuggestion[];
  generating: boolean;
  onAddMore: () => void;
  onRestore: (s: PlanSuggestion) => void;
  onRemoveUsed: (s: PlanSuggestion) => void;
  /** Extra content under the queue (the teacher's own lesson-idea notes). */
  children?: React.ReactNode;
}

const topicOf = (s: PlanSuggestion) => (s.suggested_topic || '').trim() || 'Untitled suggestion';

const FeaturedCard: React.FC<{
  studentId: string;
  item: UpNextItem<PlanSuggestion>;
  generating: boolean;
  actions: UpNextActions;
}> = ({ studentId, item, generating, actions }) => {
  const s = item.suggestion;
  const storageKey = `dslm.nextStep.detailsOpen.${studentId}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) setOpen(stored === '1');
    } catch { /* storage unavailable */ }
  }, [storageKey]);
  const toggle = (next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* storage unavailable */ }
  };
  const caption = formatPhaseCaption(item);
  const why = (s.rationale || '').trim() || (s.suggested_goal || '').trim();

  return (
    <article
      data-spotlight="pick-idea"
      data-testid="plan-up-next-featured"
      className="rounded-lg border border-border border-l-4 border-l-primary bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide">Next lesson</span>
        {caption && <span className="min-w-0 truncate">· {caption}</span>}
        <Badge variant="secondary" className="ml-auto font-normal">Also in Prep</Badge>
      </div>
      <h4 className="mt-2 break-words text-lg font-semibold leading-snug text-foreground">{topicOf(s)}</h4>
      {why && (
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Why: </span>
          {why}
        </p>
      )}
      <Collapsible open={open} onOpenChange={toggle}>
        <CollapsibleTrigger asChild>
          <Button variant="link" size="sm" className="h-auto px-0 text-xs" aria-expanded={open}>
            {open ? 'Less' : 'More about this lesson'}
            <ChevronDown className={cn('ml-1 h-3 w-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <SuggestionWhyPanel suggestion={s} hideRationale={!!(s.rationale || '').trim()} />
        </CollapsibleContent>
      </Collapsible>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => actions.onGenerate(s)} className="w-full sm:w-auto">
          <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" />
          Generate worksheet
        </Button>
        <Button variant="outline" onClick={() => actions.onEdit(s)}>Edit</Button>
        <SuggestionActionsMenu
          topic={topicOf(s)}
          generating={generating}
          onFillForm={() => actions.onFillForm(s)}
          onRegenerate={() => actions.onRegenerate(s)}
          onMarkTaught={() => actions.onMarkTaught(s)}
          onRemove={() => actions.onRemove(s)}
        />
      </div>
    </article>
  );
};

const QueueRow: React.FC<{
  position: number;
  item: UpNextItem<PlanSuggestion>;
  generating: boolean;
  actions: UpNextActions;
}> = ({ position, item, generating, actions }) => {
  const [open, setOpen] = useState(false);
  const s = item.suggestion;
  const caption = formatPhaseCaption(item) || 'Free step';
  return (
    <li>
      <div className="flex items-center gap-2 rounded-md pr-1 hover:bg-muted/50">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 px-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">{position}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{topicOf(s)}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {caption}
              {s.suggested_grammar_focus ? ` · ${s.suggested_grammar_focus}` : ''}
            </span>
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
        <SuggestionActionsMenu
          topic={topicOf(s)}
          generating={generating}
          onGenerate={() => actions.onGenerate(s)}
          onFillForm={() => actions.onFillForm(s)}
          onEdit={() => actions.onEdit(s)}
          onRegenerate={() => actions.onRegenerate(s)}
          onMarkTaught={() => actions.onMarkTaught(s)}
          onRemove={() => actions.onRemove(s)}
        />
      </div>
      {open && (
        <div className="pb-3 pl-10 pr-2 pt-1">
          <SuggestionWhyPanel suggestion={s} />
        </div>
      )}
    </li>
  );
};

export const UpNextSection: React.FC<UpNextSectionProps> = ({
  studentId,
  items,
  usedSteps,
  generating,
  onAddMore,
  onRestore,
  onRemoveUsed,
  children,
  ...actions
}) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [first, ...rest] = items;

  return (
    <PlanSection
      id="plan-up-next"
      title="Up next"
      spotlight="next-lesson-ideas"
      action={
        <Button variant="ghost" size="sm" onClick={onAddMore} disabled={generating}>
          {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />}
          Add suggestions
        </Button>
      }
    >
      {first && <FeaturedCard studentId={studentId} item={first} generating={generating} actions={actions} />}

      {rest.length > 0 && (
        <ol className="divide-y divide-border rounded-lg border border-border bg-card" aria-label="Later lessons">
          {rest.map((item, index) => (
            <QueueRow key={item.suggestion.id} position={index + 2} item={item} generating={generating} actions={actions} />
          ))}
        </ol>
      )}

      <div className="space-y-1">
      {children}
      {usedSteps.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="px-2 text-muted-foreground" aria-expanded={historyOpen}>
              <History className="mr-1.5 h-4 w-4" aria-hidden="true" />
              History ({usedSteps.length})
              <ChevronDown className={cn('ml-1 h-3 w-3 transition-transform', historyOpen && 'rotate-180')} aria-hidden="true" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1">
            <ul className="divide-y divide-border rounded-lg border border-border bg-card" aria-label="Taught lessons">
              {usedSteps.map((s, index) => {
                const usedAge = formatRelativeAge(s.used_at);
                return (
                  <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{topicOf(s)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {usedAge ? `Used ${usedAge.charAt(0).toLowerCase()}${usedAge.slice(1)}` : 'Used'}
                        {s.used_worksheet_id ? '' : ' · marked manually'}
                      </span>
                    </span>
                    <SuggestionActionsMenu
                      topic={topicOf(s)}
                      onRestore={index === 0 ? () => onRestore(s) : undefined}
                      onRemove={() => onRemoveUsed(s)}
                    />
                  </li>
                );
              })}
            </ul>
            <p className="px-2 pt-1 text-xs text-muted-foreground">Only the most recent lesson can be restored to the queue.</p>
          </CollapsibleContent>
        </Collapsible>
      )}
      </div>
    </PlanSection>
  );
};
