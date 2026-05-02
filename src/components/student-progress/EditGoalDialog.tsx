/**
 * EditGoalDialog — DSLM v5.0
 *
 * Edit any goal (supporting/additional): title, description, deadline.
 * Deadline uses the new DeadlinePicker (quick-pick presets + custom date toggle).
 */
import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { DeadlinePicker } from '@/components/shared/DeadlinePicker';

interface EditGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: { id: string; title: string; description: string | null; target_date: string | null } | null;
  onSave: (updates: { title: string; description: string; target_date: string | null }) => Promise<void> | void;
}

export const EditGoalDialog: React.FC<EditGoalDialogProps> = ({ open, onOpenChange, goal, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (goal) {
      setTitle(goal.title);
      setDescription(goal.description || '');
      setTargetDate(goal.target_date ? goal.target_date.slice(0, 10) : '');
    }
  }, [goal]);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), target_date: targetDate || null });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Goal</DialogTitle>
          <DialogDescription>Update the goal title, description, or deadline.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goal title" />
          </div>
          <div>
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="More details about this goal…" />
          </div>
          <div>
            <Label>Deadline (optional)</Label>
            <DeadlinePicker value={targetDate} onChange={setTargetDate} />
            <p className="text-[11px] text-muted-foreground mt-1">When set, AI will pace phases/steps to complete before this date.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};