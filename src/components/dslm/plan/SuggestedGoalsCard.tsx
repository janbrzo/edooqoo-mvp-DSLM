/**
 * SuggestedGoalsCard — goals inferred by `process-welcome-test`
 * (`source = 'welcome_test_auto'`, no `accepted_at`) waiting for the teacher.
 *
 * Extracted 1:1 from GoalsView (v6.9.47 optimistic accept/dismiss) so the same
 * card can live in the Learning plan "Needs your OK" strip and in GoalsView.
 */
import React, { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { devWarn } from '@/utils/logger';
import type { ProgressGoal } from '@/types/studentProgress';
import { isSuggestedGoal } from '@/lib/dslm/goals';

interface SuggestedGoalsCardProps {
  goals: readonly ProgressGoal[];
  updateGoal: (goalId: string, updates: { accepted_at?: string | null }) => Promise<boolean>;
  deleteGoal: (goalId: string) => Promise<unknown>;
  /** Called after any accept/dismiss so attention signals can refresh. */
  onChanged?: () => void;
}

export const SuggestedGoalsCard: React.FC<SuggestedGoalsCardProps> = ({ goals, updateGoal, deleteGoal, onChanged }) => {
  // Optimistic state: locally accepted/dismissed ids hide the suggestion
  // immediately, before the realtime refetch lands.
  const [optimisticAccepted, setOptimisticAccepted] = useState<Set<string>>(new Set());
  const [optimisticDismissed, setOptimisticDismissed] = useState<Set<string>>(new Set());
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [dismissingAll, setDismissingAll] = useState(false);

  const suggestedGoals = goals.filter(
    (g) => isSuggestedGoal(g) && !optimisticAccepted.has(g.id) && !optimisticDismissed.has(g.id),
  );

  const changed = () => {
    window.dispatchEvent(new CustomEvent('attentionDirty'));
    onChanged?.();
  };

  const acceptAllSuggested = async () => {
    if (suggestedGoals.length === 0) return;
    setAcceptingAll(true);
    const ids = suggestedGoals.map((g) => g.id);
    setOptimisticAccepted((prev) => { const n = new Set(prev); ids.forEach((i) => n.add(i)); return n; });
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('student_progress_goals')
        .update({ accepted_at: now })
        .in('id', ids);
      if (error) throw error;
      toast.success('Suggested goals accepted.');
      // useStudentProgress re-fetches on this event; covers a delayed realtime channel.
      window.dispatchEvent(new CustomEvent('student-progress:refresh'));
      changed();
    } catch (err) {
      devWarn('acceptAllSuggested failed', err);
      toast.error('Could not accept suggestions.');
      setOptimisticAccepted((prev) => { const n = new Set(prev); ids.forEach((i) => n.delete(i)); return n; });
    } finally { setAcceptingAll(false); }
  };

  const dismissAllSuggested = async () => {
    if (suggestedGoals.length === 0) return;
    setDismissingAll(true);
    const ids = suggestedGoals.map((g) => g.id);
    setOptimisticDismissed((prev) => { const n = new Set(prev); ids.forEach((i) => n.add(i)); return n; });
    try {
      await Promise.all(ids.map((id) => deleteGoal(id)));
      toast.success('Suggestions dismissed.');
      changed();
    } catch (err) {
      devWarn('dismissAllSuggested failed', err);
      toast.error('Could not dismiss suggestions.');
      setOptimisticDismissed((prev) => { const n = new Set(prev); ids.forEach((i) => n.delete(i)); return n; });
    } finally { setDismissingAll(false); }
  };

  const acceptSuggested = async (id: string) => {
    setOptimisticAccepted((prev) => { const n = new Set(prev); n.add(id); return n; });
    const success = await updateGoal(id, { accepted_at: new Date().toISOString() });
    if (success) {
      toast.success('Suggestion accepted.');
      changed();
    } else {
      setOptimisticAccepted((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const dismissSuggested = async (id: string) => {
    setOptimisticDismissed((prev) => { const n = new Set(prev); n.add(id); return n; });
    try {
      await deleteGoal(id);
      toast.success('Suggestion dismissed.');
      changed();
    } catch (err) {
      devWarn('dismissSuggested failed', err);
      toast.error('Could not dismiss suggestion.');
      setOptimisticDismissed((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  if (suggestedGoals.length === 0) return null;

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="space-y-2 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">Suggested from Welcome Test</span>
          <Badge variant="secondary" className="text-[10px]">{suggestedGoals.length}</Badge>
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={acceptAllSuggested} disabled={acceptingAll}>
              <Check className="mr-1 h-3 w-3" aria-hidden="true" /> Accept all
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={dismissAllSuggested} disabled={dismissingAll}>
              <X className="mr-1 h-3 w-3" aria-hidden="true" /> Dismiss all
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          These goals were inferred from the student's Welcome Test results. Accept to keep them in the plan, dismiss to remove, or edit individual goals below.
        </p>
        <ul className="space-y-1.5 pl-1 text-xs">
          {suggestedGoals.map((g) => (
            <li
              key={g.id}
              className="grid grid-cols-1 items-start gap-2 rounded-md border border-border/40 bg-background/60 px-2 py-1.5 sm:grid-cols-[1fr_auto]"
            >
              <div className="flex min-w-0 items-start gap-1.5">
                <span className="mt-0.5 text-primary" aria-hidden="true">•</span>
                <span className="break-words">
                  <span className="font-medium">{g.title}</span>
                  {g.description ? ` — ${g.description}` : ''}
                </span>
              </div>
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => acceptSuggested(g.id)}>
                  <Check className="mr-1 h-3 w-3" aria-hidden="true" /> Accept
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={() => dismissSuggested(g.id)}>
                  <X className="mr-1 h-3 w-3" aria-hidden="true" /> Dismiss
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};
