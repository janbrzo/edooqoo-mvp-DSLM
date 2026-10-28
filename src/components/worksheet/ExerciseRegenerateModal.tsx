import React, { useEffect, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RefreshCw } from 'lucide-react';

interface ExerciseRegenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  guidelines: string;
  onGuidelinesChange: (value: string) => void;
  exerciseType: string;
  exerciseTitle: string;
  /** Set when students already answered this exercise: regenerating needs an explicit acknowledgement. */
  answersWarning?: string;
}

const ExerciseRegenerateModal: React.FC<ExerciseRegenerateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  guidelines,
  onGuidelinesChange,
  exerciseType,
  exerciseTitle,
  answersWarning
}) => {
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    if (!isOpen) setAcknowledged(false);
  }, [isOpen]);
  const blocked = Boolean(answersWarning) && !acknowledged;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-worksheet-purple" />
            Regenerate Exercise
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Exercise:</strong> {exerciseTitle}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Type:</strong> {exerciseType.charAt(0).toUpperCase() + exerciseType.slice(1).replace(/-/g, ' ')}
            </p>
          </div>

          {answersWarning && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-2" role="alert">
              <p className="text-sm text-destructive">{answersWarning}</p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="regenerate-ack"
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                />
                <Label htmlFor="regenerate-ack" className="text-sm font-normal cursor-pointer">
                  I understand, regenerate anyway
                </Label>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="guidelines">
              Additional Guidelines (Optional)
            </Label>
            <Textarea
              id="guidelines"
              placeholder="Add any specific requirements for the new exercise version..."
              value={guidelines}
              onChange={(e) => onGuidelinesChange(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              Examples: "Make it more challenging", "Focus on present perfect tense", "Use business vocabulary"
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={blocked}
              className="bg-worksheet-purple hover:bg-worksheet-purple/90"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate Exercise
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ExerciseRegenerateModal;