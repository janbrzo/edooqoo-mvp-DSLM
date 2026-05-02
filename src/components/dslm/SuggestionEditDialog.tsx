/**
 * SuggestionEditDialog — shared modal for editing a suggestion.
 * v4.2: now also edits exercises[] and exerciseFocusMap{} via EditExerciseSelector.
 */
import React from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Check, X } from 'lucide-react';
import { EditExerciseSelector } from './EditExerciseSelector';

export interface SuggestionEditValue {
  topic: string;
  goal: string;
  additionalInfo: string;
  grammarFocus: string;
  exercises: string[];
  exerciseFocusMap: Record<string, string>;
}

interface SuggestionEditDialogProps {
  open: boolean;
  value: SuggestionEditValue;
  onChange: (updates: Partial<SuggestionEditValue>) => void;
  onSave: () => void;
  onCancel: () => void;
}

export const SuggestionEditDialog: React.FC<SuggestionEditDialogProps> = ({
  open, value, onChange, onSave, onCancel,
}) => {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit suggestion</DialogTitle>
          <DialogDescription>Update topic, goal, focus and exercise types.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Topic</Label>
            <Input value={value.topic} onChange={(e) => onChange({ topic: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Goal</Label>
            <Input value={value.goal} onChange={(e) => onChange({ goal: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Additional Information</Label>
            <Textarea
              value={value.additionalInfo}
              onChange={(e) => onChange({ additionalInfo: e.target.value })}
              className="h-16 text-sm"
              placeholder="Extra context..."
            />
          </div>
          <div>
            <Label className="text-xs">Grammar Focus</Label>
            <Input
              value={value.grammarFocus}
              onChange={(e) => onChange({ grammarFocus: e.target.value })}
              placeholder="e.g., Present Perfect..."
            />
          </div>
          <div>
            <Label className="text-xs">Exercises</Label>
            <EditExerciseSelector
              selected={value.exercises}
              focusMap={value.exerciseFocusMap}
              onChange={({ selected, focusMap }) => onChange({ exercises: selected, exerciseFocusMap: focusMap })}
              max={8}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" /> Cancel
          </Button>
          <Button onClick={onSave} disabled={!value.topic.trim()}>
            <Check className="h-4 w-4 mr-1" /> Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
