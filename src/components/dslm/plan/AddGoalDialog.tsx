/**
 * AddGoalDialog — create a learning goal. Extracted 1:1 from GoalsView so the
 * Learning plan (setup checklist, Goals section, `focus=add-goal-modal`,
 * `dslm:addGoal`) and GoalsView share one form.
 */
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DeadlinePicker } from '@/components/shared/DeadlinePicker';
import { GOAL_TYPES } from '@/types/studentProgress';

export interface NewGoalValue {
  type: string;
  title: string;
  description: string;
  targetDate: string;
}

interface AddGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentName: string;
  /** Goal type preselected when the dialog opens. */
  initialType?: string;
  onSubmit: (value: NewGoalValue) => Promise<unknown> | void;
}

const emptyGoal = (type: string): NewGoalValue => ({ type, title: '', description: '', targetDate: '' });

export const AddGoalDialog: React.FC<AddGoalDialogProps> = ({
  open,
  onOpenChange,
  studentName,
  initialType = 'supporting',
  onSubmit,
}) => {
  const [value, setValue] = useState<NewGoalValue>(emptyGoal(initialType));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValue(emptyGoal(initialType));
  }, [open, initialType]);

  const submit = async () => {
    if (!value.title.trim()) return;
    setSaving(true);
    try {
      await onSubmit(value);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Goal</DialogTitle>
          <DialogDescription>Create a new learning goal for {studentName}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Goal Type</Label>
            <Select value={value.type} onValueChange={(type) => setValue((v) => ({ ...v, type }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GOAL_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="add-goal-title">Title</Label>
            <Input
              id="add-goal-title"
              value={value.title}
              onChange={(e) => setValue((v) => ({ ...v, title: e.target.value }))}
              placeholder="e.g. Master business email writing"
            />
          </div>
          <div>
            <Label htmlFor="add-goal-description">Description (optional)</Label>
            <Textarea
              id="add-goal-description"
              value={value.description}
              onChange={(e) => setValue((v) => ({ ...v, description: e.target.value }))}
              placeholder="More details about this goal..."
            />
          </div>
          <div>
            <Label>Deadline (optional)</Label>
            <DeadlinePicker value={value.targetDate} onChange={(targetDate) => setValue((v) => ({ ...v, targetDate }))} />
            <p className="mt-1 text-[11px] text-muted-foreground">When set, AI will pace phases/steps to complete before this date.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!value.title.trim() || saving}>Add Goal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
