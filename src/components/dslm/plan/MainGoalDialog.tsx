/**
 * MainGoalDialog: edit the student's main goal and its deadline. Same
 * fields and save order as the inline editor in GoalsView.
 */
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DeadlinePicker } from '@/components/shared/DeadlinePicker';
import { MAIN_GOALS } from '@/constants/studentGoals';

interface MainGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mainGoal: string;
  mainGoalTargetDate: string | null;
  onMainGoalChange?: (newGoal: string) => Promise<void> | void;
  onMainGoalTargetDateChange?: (date: string | null) => Promise<void> | void;
}

export const MainGoalDialog: React.FC<MainGoalDialogProps> = ({
  open,
  onOpenChange,
  mainGoal,
  mainGoalTargetDate,
  onMainGoalChange,
  onMainGoalTargetDateChange,
}) => {
  const [goal, setGoal] = useState(mainGoal);
  const [date, setDate] = useState(mainGoalTargetDate || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGoal(mainGoal);
    setDate(mainGoalTargetDate || '');
  }, [open, mainGoal, mainGoalTargetDate]);

  const save = async () => {
    setSaving(true);
    try {
      if (onMainGoalChange && goal && goal !== mainGoal) await onMainGoalChange(goal);
      if (onMainGoalTargetDateChange) await onMainGoalTargetDateChange(date || null);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Main goal</DialogTitle>
          <DialogDescription>What the student needs English for, and by when.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Goal</Label>
            <Select value={goal || undefined} onValueChange={setGoal}>
              <SelectTrigger><SelectValue placeholder="Choose a main goal" /></SelectTrigger>
              <SelectContent>
                {/* A free-text goal (paste intake, older students) stays selectable as-is. */}
                {mainGoal && !MAIN_GOALS.some((g) => g.value === mainGoal) && (
                  <SelectItem value={mainGoal}>{mainGoal}</SelectItem>
                )}
                {MAIN_GOALS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Deadline (optional)</Label>
            <DeadlinePicker value={date} onChange={setDate} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !goal}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
