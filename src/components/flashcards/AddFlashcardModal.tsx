import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CreateFlashcardCard, UpdateFlashcardCard, FlashcardCard } from '@/types/flashcards';
import { useFlashcardTranslation } from '@/hooks/useFlashcardTranslation';
import { useFlashcardDefinition } from '@/hooks/useFlashcardDefinition';
import { Loader2 } from 'lucide-react';

interface AddFlashcardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
  onAdd: (data: CreateFlashcardCard) => Promise<void>;
  studentNativeLanguage: string;
  backType?: 'translation' | 'definition';
  editingCard?: FlashcardCard;
  onUpdate?: (updates: UpdateFlashcardCard) => Promise<void>;
  onCloseEdit?: () => void;
}

export function AddFlashcardModal({
  open,
  onOpenChange,
  setId,
  onAdd,
  studentNativeLanguage,
  backType = 'translation',
  editingCard,
  onUpdate,
  onCloseEdit,
}: AddFlashcardModalProps) {
  const [frontText, setFrontText] = useState('');
  const [frontExample, setFrontExample] = useState('');
  const [backText, setBackText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userEditedBackText, setUserEditedBackText] = useState(false);

  const isEditMode = !!editingCard;

  // Auto-translation hook (only for non-edit mode and translation type)
  const { translation, cefrLevel: translationCefrLevel, isTranslating, translateText, clearTranslation } = useFlashcardTranslation({
    targetLanguage: backType === 'translation' ? studentNativeLanguage : undefined,
    enabled: backType === 'translation' && !isEditMode && !!studentNativeLanguage,
  });

  // Auto-definition hook (only for non-edit mode and definition type)
  const { definition, cefrLevel: definitionCefrLevel, isLoadingDefinition, fetchDefinition, clearDefinition } = useFlashcardDefinition({
    enabled: backType === 'definition' && !isEditMode,
  });

  // Get the current CEFR level from whichever hook is active
  const currentCefrLevel = backType === 'translation' ? translationCefrLevel : definitionCefrLevel;

  // Reset form when modal opens/closes or editing card changes
  useEffect(() => {
    if (editingCard) {
      setFrontText(editingCard.front_text);
      setFrontExample(editingCard.front_example || '');
      setBackText(editingCard.back_text);
      setUserEditedBackText(false);
    } else if (open) {
      // Clear everything when opening modal for new card
      setFrontText('');
      setFrontExample('');
      setBackText('');
      setUserEditedBackText(false);
      clearTranslation();
      clearDefinition();
    }
  }, [editingCard, open, clearTranslation, clearDefinition]);

  // Auto-translate when frontText changes (debounced in hook)
  useEffect(() => {
    if (!isEditMode && backType === 'translation' && studentNativeLanguage && frontText.trim().length > 2 && !userEditedBackText) {
      translateText(frontText);
    }
  }, [frontText, isEditMode, backType, studentNativeLanguage, translateText, userEditedBackText]);

  // Auto-fetch definition when frontText changes (debounced in hook)
  useEffect(() => {
    if (!isEditMode && backType === 'definition' && frontText.trim().length > 2 && !userEditedBackText) {
      fetchDefinition(frontText);
    }
  }, [frontText, isEditMode, backType, fetchDefinition, userEditedBackText]);

  // Update backText when translation is ready, but only if user hasn't edited it and in translation mode
  useEffect(() => {
    if (!isEditMode && translation && !userEditedBackText && backType === 'translation') {
      setBackText(translation);
    }
  }, [translation, isEditMode, userEditedBackText, backType]);

  // Update backText when definition is ready, but only if user hasn't edited it and in definition mode
  useEffect(() => {
    if (!isEditMode && definition && !userEditedBackText && backType === 'definition') {
      setBackText(definition);
    }
  }, [definition, isEditMode, userEditedBackText, backType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!frontText.trim() || !backText.trim()) return;

    setIsSubmitting(true);
    
    if (isEditMode && onUpdate) {
      await onUpdate({
        front_text: frontText.trim(),
        front_example: frontExample.trim() || undefined,
        back_text: backText.trim(),
      });
      onCloseEdit?.();
    } else {
      await onAdd({
        set_id: setId,
        front_text: frontText.trim(),
        front_example: frontExample.trim() || undefined,
        back_text: backText.trim(),
        source_type: 'manual',
        cefr_level: currentCefrLevel || undefined,
      });
    }

    setFrontText('');
    setFrontExample('');
    setBackText('');
    onOpenChange(false);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    if (isEditMode) {
      onCloseEdit?.();
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? 'Edit Flashcard' : 'Add Flashcard'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="front">English Term *</Label>
            <Input
              id="front"
              value={frontText}
              onChange={(e) => setFrontText(e.target.value)}
              placeholder="e.g., accomplish"
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="example">Example Sentence (optional)</Label>
            <Textarea
              id="example"
              value={frontExample}
              onChange={(e) => setFrontExample(e.target.value)}
              placeholder="e.g., She accomplished her goal of learning English."
              rows={2}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="back">
              {backType === 'translation' ? `${studentNativeLanguage} Translation *` : 'English Definition *'}
            </Label>
            <div className="relative">
              <Input
                id="back"
                value={backText}
                onChange={(e) => {
                  setBackText(e.target.value);
                  setUserEditedBackText(true);
                }}
                placeholder={
                  backType === 'translation'
                    ? `Translation in ${studentNativeLanguage}...`
                    : 'Definition in English...'
                }
                required
                className="mt-1.5"
              />
              {(isTranslating || isLoadingDefinition) && !isEditMode && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            {!isEditMode && backType === 'translation' && translation && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 Auto-suggested translation
              </p>
            )}
            {!isEditMode && backType === 'definition' && definition && (
              <p className="text-xs text-muted-foreground mt-1">
                💡 Auto-suggested definition
              </p>
            )}
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <span>Preview:</span>
              {currentCefrLevel && (
                <span className="px-1.5 py-0.5 rounded text-xs border font-medium bg-background">{currentCefrLevel}</span>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Front:</span>{' '}
                <span className="font-medium">{frontText || '(empty)'}</span>
              </div>
              {frontExample && (
                <div className="text-xs italic text-muted-foreground">
                  "{frontExample}"
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Back:</span>{' '}
                <span>{backText || '(empty)'}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !frontText.trim() || !backText.trim()}
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Card' : 'Add Card'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
