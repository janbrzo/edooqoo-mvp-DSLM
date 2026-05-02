import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreateFlashcardSet } from '@/types/flashcards';

interface CreateFlashcardSetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  onCreate: (data: CreateFlashcardSet) => Promise<any>;
}

export function CreateFlashcardSetModal({
  open,
  onOpenChange,
  studentId,
  studentName,
  onCreate,
}: CreateFlashcardSetModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isBidirectional, setIsBidirectional] = useState(true);
  const [backType, setBackType] = useState<'translation' | 'definition'>('translation');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const result = await onCreate({
      student_id: studentId,
      title: title.trim(),
      description: description.trim() || undefined,
      is_bidirectional: isBidirectional,
      back_type: backType,
    });

    if (result) {
      setTitle('');
      setDescription('');
      setIsBidirectional(true);
      setBackType('translation');
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Flashcard Set</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="student" className="text-sm text-muted-foreground">
              Student
            </Label>
            <Input
              id="student"
              value={studentName}
              disabled
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Past Perfect Vocabulary"
              required
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this flashcard set..."
              rows={3}
              className="mt-1.5"
            />
          </div>

          <div className="space-y-3">
            <Label>Back Side Content Type</Label>
            <RadioGroup value={backType} onValueChange={(val) => setBackType(val as 'translation' | 'definition')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="translation" id="translation" />
                <Label htmlFor="translation" className="font-normal cursor-pointer">
                  Translation to native language
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="definition" id="definition" />
                <Label htmlFor="definition" className="font-normal cursor-pointer">
                  English definition
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="bidirectional">Bidirectional Cards</Label>
              <div className="text-sm text-muted-foreground">
                Practice both English → Native and Native → English
              </div>
            </div>
            <Switch
              id="bidirectional"
              checked={isBidirectional}
              onCheckedChange={setIsBidirectional}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Creating...' : 'Create Set'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
