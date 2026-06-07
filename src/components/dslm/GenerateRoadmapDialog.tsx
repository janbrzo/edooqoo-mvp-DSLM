/**
 * v6.9.41 P6 — Guided roadmap generation dialog.
 *
 * Teacher can influence:
 *  - Phase count (auto-fit by default, manual 1..8)
 *  - Weeks per phase (auto-fit by default, single value OR per-phase customization)
 *  - Focused goals (auto by default, checkbox list when off)
 *  - Additional guidance / context (free text)
 *
 * Sanctity: no Worksheet Generation Engine changes; only DSLM roadmap.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Sparkles } from 'lucide-react';

export interface RoadmapGoalOption {
  id: string;
  title: string;
  goal_type?: string | null;
  target_date?: string | null;
}

export interface GenerateRoadmapDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  mode: 'replace' | 'add';
  goals: RoadmapGoalOption[];
  generating: boolean;
  /** v6.9.42 — adjusts title/description/CTA copy for regen vs first-time. */
  isRegeneration?: boolean;
  onConfirm: (opts: {
    count?: number;
    weeksPerPhase?: number;
    phaseWeekTargets?: number[];
    focusedGoalIds?: string[];
    teacherComment?: string;
  }) => void | Promise<void>;
}

const clampInt = (v: any, min: number, max: number, fallback: number) => {
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

export const GenerateRoadmapDialog: React.FC<GenerateRoadmapDialogProps> = ({
  open, onOpenChange, mode, goals, generating, onConfirm, isRegeneration = false,
}) => {
  const [autoCount, setAutoCount] = useState(true);
  const [count, setCount] = useState(4);

  const [autoWeeks, setAutoWeeks] = useState(true);
  const [weeksPerPhase, setWeeksPerPhase] = useState(4);
  const [customizePerPhase, setCustomizePerPhase] = useState(false);
  const [perPhaseWeeks, setPerPhaseWeeks] = useState<number[]>([]);

  const [autoGoals, setAutoGoals] = useState(true);
  const [focusedGoalIds, setFocusedGoalIds] = useState<string[]>([]);

  const [comment, setComment] = useState('');

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setAutoCount(true);
    setCount(4);
    setAutoWeeks(true);
    setWeeksPerPhase(4);
    setCustomizePerPhase(false);
    setPerPhaseWeeks([]);
    setAutoGoals(true);
    setFocusedGoalIds([]);
    setComment('');
  }, [open]);

  // Keep perPhaseWeeks length in sync with count when per-phase customization is on.
  useEffect(() => {
    if (!customizePerPhase) return;
    const target = autoCount ? 4 : count; // fall back to 4 if autoCount but per-phase enabled (rare)
    setPerPhaseWeeks((prev) => {
      if (prev.length === target) return prev;
      const next = [...prev];
      while (next.length < target) next.push(weeksPerPhase || 4);
      next.length = target;
      return next;
    });
  }, [customizePerPhase, count, autoCount, weeksPerPhase]);

  const canCustomizePerPhase = !autoCount; // per-phase only makes sense with explicit count
  const effectivePerPhaseWeeks = useMemo(() => {
    if (!customizePerPhase || autoCount) return undefined;
    if (perPhaseWeeks.length === 0) return undefined;
    return perPhaseWeeks.map((w) => clampInt(w, 1, 12, 4));
  }, [customizePerPhase, autoCount, perPhaseWeeks]);

  const handleConfirm = async () => {
    const payload: Parameters<GenerateRoadmapDialogProps['onConfirm']>[0] = {};
    if (!autoCount) payload.count = clampInt(count, 1, 8, 4);
    if (effectivePerPhaseWeeks) {
      payload.phaseWeekTargets = effectivePerPhaseWeeks;
    } else if (!autoWeeks) {
      payload.weeksPerPhase = clampInt(weeksPerPhase, 1, 12, 4);
    }
    if (!autoGoals && focusedGoalIds.length > 0) {
      payload.focusedGoalIds = focusedGoalIds;
    }
    const trimmed = comment.trim();
    if (trimmed.length > 0) payload.teacherComment = trimmed;
    await onConfirm(payload);
    onOpenChange(false);
  };

  const toggleGoal = (id: string) => {
    setFocusedGoalIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isRegeneration
              ? 'Regenerate Learning Roadmap'
              : mode === 'replace' ? 'Generate Learning Roadmap' : 'Add roadmap phases'}
          </DialogTitle>
          <DialogDescription>
            {isRegeneration
              ? 'This regenerates ONLY planned and draft phases. Phases marked done or in progress keep their exact records, week ranges, and worksheet suggestions. Auto-fit gives full control to the AI — toggle anything off to steer the plan yourself.'
              : 'Auto-fit gives full control to the AI. Toggle anything off to steer the plan yourself.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Phase count */}
          <section className="space-y-2 border rounded-md p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Number of phases</Label>
                <p className="text-[11px] text-muted-foreground">
                  Macro learning blocks (foundations → application → fluency). Suggested: 3–5.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Auto-fit</span>
                <Switch checked={autoCount} onCheckedChange={(v) => { setAutoCount(v); if (v) setCustomizePerPhase(false); }} />
              </div>
            </div>
            {!autoCount && (
              <div className="flex items-center gap-2 pt-1">
                <Input type="number" min={1} max={8} value={count}
                  onChange={(e) => setCount(clampInt(e.target.value, 1, 8, 4))}
                  className="h-9 w-24" />
                <span className="text-[11px] text-muted-foreground">phases (1–8)</span>
              </div>
            )}
          </section>

          {/* Weeks per phase */}
          <section className="space-y-2 border rounded-md p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Weeks per phase</Label>
                <p className="text-[11px] text-muted-foreground">
                  How long each phase lasts. AI will still respect the deadline as a hard cap.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Auto-fit</span>
                <Switch checked={autoWeeks} onCheckedChange={(v) => { setAutoWeeks(v); if (v) setCustomizePerPhase(false); }} />
              </div>
            </div>
            {!autoWeeks && (
              <div className="space-y-2 pt-1">
                {!customizePerPhase && (
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={12} value={weeksPerPhase}
                      onChange={(e) => setWeeksPerPhase(clampInt(e.target.value, 1, 12, 4))}
                      className="h-9 w-24" />
                    <span className="text-[11px] text-muted-foreground">weeks (1–12) per phase</span>
                  </div>
                )}
                {canCustomizePerPhase && (
                  <div className="flex items-center gap-2">
                    <Checkbox id="customize-per-phase" checked={customizePerPhase} onCheckedChange={(v) => setCustomizePerPhase(!!v)} />
                    <Label htmlFor="customize-per-phase" className="text-[11px] cursor-pointer">
                      Customize weeks for each phase
                    </Label>
                  </div>
                )}
                {customizePerPhase && (
                  <div className="space-y-1.5 pt-1">
                    {Array.from({ length: count }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground w-16">Phase {i + 1}</span>
                        <Input type="number" min={1} max={12}
                          value={perPhaseWeeks[i] ?? weeksPerPhase}
                          onChange={(e) => {
                            const v = clampInt(e.target.value, 1, 12, 4);
                            setPerPhaseWeeks((prev) => {
                              const next = [...prev];
                              while (next.length < count) next.push(weeksPerPhase || 4);
                              next[i] = v;
                              return next;
                            });
                          }}
                          className="h-8 w-24" />
                        <span className="text-[11px] text-muted-foreground">weeks</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Focused goals */}
          <section className="space-y-2 border rounded-md p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Focused goals</Label>
                <p className="text-[11px] text-muted-foreground">
                  Tell AI which goals matter most. Others still inform pacing but won't drive phases.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Auto-select</span>
                <Switch checked={autoGoals} onCheckedChange={setAutoGoals} disabled={goals.length === 0} />
              </div>
            </div>
            {!autoGoals && (
              goals.length === 0 ? (
                <p className="text-[11px] text-muted-foreground pt-1">No active goals — add some on the Goals tab.</p>
              ) : (
                <ScrollArea className="max-h-44 pr-2">
                  <div className="space-y-1.5 pt-1">
                    {goals.map(g => (
                      <label key={g.id} className="flex items-start gap-2 text-xs cursor-pointer rounded hover:bg-muted/40 p-1">
                        <Checkbox checked={focusedGoalIds.includes(g.id)} onCheckedChange={() => toggleGoal(g.id)} />
                        <span className="min-w-0">
                          <span className="font-medium">{g.title}</span>
                          {g.goal_type && <span className="ml-1 text-[10px] uppercase text-muted-foreground">({g.goal_type})</span>}
                          {g.target_date && <span className="ml-1 text-[10px] text-muted-foreground">· deadline {g.target_date}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )
            )}
          </section>

          {/* Additional guidance */}
          <section className="space-y-2 border rounded-md p-3">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium" htmlFor="roadmap-comment">Additional guidance (optional)</Label>
              <p className="text-[11px] text-muted-foreground">
                Context that's not in the student profile (e.g. upcoming exam, recent trip, must-cover topics).
              </p>
            </div>
            <Textarea
              id="roadmap-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="e.g. Student starts a new role in 3 weeks and needs negotiation language. Avoid travel topics."
              className="min-h-[80px]"
              maxLength={1000}
            />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={generating}>
            {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {isRegeneration
              ? 'Regenerate roadmap'
              : mode === 'replace' ? 'Generate roadmap' : 'Add phases'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};