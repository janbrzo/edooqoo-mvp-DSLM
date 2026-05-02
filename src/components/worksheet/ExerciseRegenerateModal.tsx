import React from 'react';
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
}

const ExerciseRegenerateModal: React.FC<ExerciseRegenerateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  guidelines,
  onGuidelinesChange,
  exerciseType,
  exerciseTitle
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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