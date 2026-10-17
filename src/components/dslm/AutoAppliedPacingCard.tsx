/**
 * AutoAppliedPacingCard: info card for the pacing the first Welcome Test applied
 * on its own (Decision 5), with a one-click Undo.
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Gauge, Undo2 } from 'lucide-react';
import { useAutoAppliedWtPacing } from '@/hooks/useAutoAppliedWtPacing';
import { pacingLabel } from './PacingModeSlider';

export const AutoAppliedPacingCard: React.FC<{ studentId: string }> = ({ studentId }) => {
  const { applied, undoing, undo } = useAutoAppliedWtPacing(studentId);
  if (!applied) return null;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-2" data-testid="auto-applied-pacing-card">
      <Gauge className="h-4 w-4 text-primary flex-shrink-0" />
      <p className="text-xs text-foreground flex-1 min-w-0">
        Pacing set from the Welcome Test: {pacingLabel(applied.newPacing)} ({applied.newPacing}) (was {pacingLabel(applied.previousPacing)} ({applied.previousPacing}))
      </p>
      <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1.5" disabled={undoing} onClick={undo}>
        <Undo2 className="h-3 w-3" /> Undo
      </Button>
    </div>
  );
};
