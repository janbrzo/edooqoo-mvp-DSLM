/**
 * v6.9.29 — Shared "Generate 1-Minute Prep suggestions" dialog with phase target selector.
 * Used by NextStepsSection for both first-time and "Generate more" flows.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus } from 'lucide-react';

export interface PhaseOption {
  id: string;
  label: string;
  sequence: number;
  status: string;
  have: number;
  /** v6.9.48 — total target steps for the phase (1 per week, no clamp). */
  need: number;
  /** v6.9.48 — max steps per single generation batch (1–6, optional). */
  perBatch?: number;
  weeks: number | null;
}

interface GenerateStepsDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** "first" = empty-state (no exclude IDs); "more" = adding to existing list. */
  mode: 'first' | 'more';
  defaultCount: number;
  defaultTargetPhaseId: string | null;     // null → __free__
  phaseOptions: PhaseOption[];
  /** When true, hide phase selector (roadmap disabled). All steps will be free. */
  showPhaseSelector: boolean;
  generating: boolean;
  onConfirm: (count: number, phaseId: string | null) => void | Promise<void>;
}

const FREE_VALUE = '__free__';

export const GenerateStepsDialog: React.FC<GenerateStepsDialogProps> = ({
  open, onOpenChange, mode, defaultCount,
  defaultTargetPhaseId, phaseOptions, showPhaseSelector, generating, onConfirm,
}) => {
  const [count, setCount] = useState(defaultCount);
  const [phaseValue, setPhaseValue] = useState<string>(
    defaultTargetPhaseId ?? FREE_VALUE
  );
  const [countTouched, setCountTouched] = useState(false);

  // v6.9.14 — Reset every open. Initial count = (need - have) for recommended phase, else defaultCount.
  useEffect(() => {
    if (!open) return;
    // v6.9.15a — guard against stale defaultTargetPhaseId after a phase was deleted.
    const validId = defaultTargetPhaseId && phaseOptions.some(p => p.id === defaultTargetPhaseId)
      ? defaultTargetPhaseId
      : null;
    const initialPhaseId = validId ?? FREE_VALUE;
    setPhaseValue(initialPhaseId);
    setCountTouched(false);
    const recPhase = phaseOptions.find(p => p.id === validId);
    const initialCount = recPhase
      ? Math.min(6, Math.max(1, recPhase.need - recPhase.have))
      : defaultCount;
    setCount(initialCount);
  }, [open, defaultCount, defaultTargetPhaseId, phaseOptions]);

  const selectedPhase = useMemo(
    () => phaseOptions.find(p => p.id === phaseValue) || null,
    [phaseValue, phaseOptions]
  );

  // Auto-preset count to (need - have) when user picks a phase (unless they typed manually).
  useEffect(() => {
    if (!showPhaseSelector || countTouched || !selectedPhase) return;
    const gap = Math.max(1, selectedPhase.need - selectedPhase.have);
    setCount(Math.min(6, gap));
  }, [phaseValue, selectedPhase, showPhaseSelector, countTouched]);

  const helperText = (() => {
    if (!showPhaseSelector) {
      return 'Roadmap disabled — new steps will be free (not bound to any phase).';
    }
    if (phaseValue === FREE_VALUE) {
      return 'Free step — not bound to any phase. Use after current phase is complete or for ad-hoc topics.';
    }
    if (!selectedPhase) return null;
    if (selectedPhase.have >= selectedPhase.need) {
      return `⚠ Already at target (${selectedPhase.have}/${selectedPhase.need}). Adding more is OK.`;
    }
    const gap = selectedPhase.need - selectedPhase.have;
    const capped = Math.min(6, gap);
    if (gap > 6) {
      return `Phase has ${selectedPhase.have}/${selectedPhase.need} steps — adding ${capped} now (max 6 per batch, repeat to fill). AI receives all existing steps from this AND other phases to avoid duplicates and complement them.`;
    }
    return `Phase has ${selectedPhase.have}/${selectedPhase.need} steps. Recommended add: ${capped}. AI receives all existing steps from this AND other phases to avoid duplicates and complement them.`;
  })();

  // v6.9.15a — only treat as "recommended" if the phase still exists.
  const recommendedId = defaultTargetPhaseId && phaseOptions.some(p => p.id === defaultTargetPhaseId)
    ? defaultTargetPhaseId
    : null;
  const recPhaseForLabel = recommendedId ? phaseOptions.find(p => p.id === recommendedId) : null;
  const phaseRecommendedLabel = recPhaseForLabel
    ? `Phase ${recPhaseForLabel.sequence}: ${recPhaseForLabel.label}`
    : 'Free step';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'first' ? 'Generate 1-Minute Prep suggestions' : 'Add more 1-Minute Prep suggestions'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'first'
              ? 'How many AI-generated suggestions should we create?'
              : 'How many additional suggestions should we add?'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="gen-count" className="text-xs">Count (1–6)</Label>
            <Input
              id="gen-count"
              type="number" min="1" max="6" value={count}
              onChange={(e) => {
                setCountTouched(true);
                setCount(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)));
              }}
              className="h-9"
            />
          </div>

          {showPhaseSelector && phaseOptions.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Target phase</Label>
              <Select value={phaseValue} onValueChange={(v) => { setPhaseValue(v); setCountTouched(false); }}>
                <SelectTrigger className="h-9 min-w-0">
                  <SelectValue className="truncate text-left" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {recommendedId && phaseOptions.find(p => p.id === recommendedId) && (
                    <SelectItem value={recommendedId}>
                      <span className="block text-left">🎯 Recommended — {phaseRecommendedLabel}</span>
                    </SelectItem>
                  )}
                  {phaseOptions
                    .filter(p => p.id !== recommendedId)
                    .map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        Phase {p.sequence}: {p.label} — {p.have}/{p.need} steps
                        {p.weeks ? ` (${p.weeks}w)` : ''}
                      </SelectItem>
                    ))}
                  <SelectItem value={FREE_VALUE}>Free step (no phase)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {helperText && (
            <p className="text-[11px] text-muted-foreground leading-snug">{helperText}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              const phaseId = !showPhaseSelector || phaseValue === FREE_VALUE ? null : phaseValue;
              await onConfirm(count, phaseId);
              onOpenChange(false);
            }}
            disabled={generating}
          >
            {generating
              ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              : <Plus className="h-4 w-4 mr-2" />}
            {mode === 'first' ? 'Generate' : 'Add'} {count} suggestion{count > 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
