import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RefreshCw } from 'lucide-react';

interface SectionRegenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  guidelines: string;
  onGuidelinesChange: (value: string) => void;
  sectionType: 'warmup' | 'grammar';
  sectionTitle: string;
}

const SectionRegenerateModal: React.FC<SectionRegenerateModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  guidelines,
  onGuidelinesChange,
  sectionType,
  sectionTitle
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
            Regenerate {sectionType === 'warmup' ? 'Warmup Questions' : 'Grammar Rules'}
          </DialogTitle>
          <DialogDescription>
            Provide optional guidelines to customize the regenerated {sectionType === 'warmup' ? 'warmup questions' : 'grammar rules'}. The AI will create completely new content based on your lesson parameters.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Section:</strong> {sectionTitle}
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>Type:</strong> {sectionType === 'warmup' ? 'Warmup Questions' : 'Grammar Rules'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="guidelines">
              Additional Guidelines (Optional)
            </Label>
            <Textarea
              id="guidelines"
              placeholder={`Add any specific requirements for the new ${sectionType === 'warmup' ? 'warmup questions' : 'grammar rules'}...`}
              value={guidelines}
              onChange={(e) => onGuidelinesChange(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-gray-500">
              {sectionType === 'warmup' 
                ? 'Examples: "Make questions more conversational", "Focus on personal experiences", "Add follow-up questions"'
                : 'Examples: "Add more examples", "Simplify explanations", "Focus on common mistakes"'
              }
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
              Regenerate {sectionType === 'warmup' ? 'Warmup' : 'Grammar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SectionRegenerateModal;
