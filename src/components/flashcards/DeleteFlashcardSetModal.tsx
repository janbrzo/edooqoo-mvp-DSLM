import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface DeleteFlashcardSetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setTitle: string;
  onConfirmDelete: () => void;
}

export function DeleteFlashcardSetModal({
  open,
  onOpenChange,
  setTitle,
  onConfirmDelete,
}: DeleteFlashcardSetModalProps) {
  const [confirmText, setConfirmText] = useState('');

  const handleCopyTitle = () => {
    navigator.clipboard.writeText(setTitle);
    toast({
      title: 'Copied',
      description: 'Set name copied to clipboard',
    });
  };

  const handleDelete = () => {
    if (confirmText === setTitle) {
      onConfirmDelete();
      onOpenChange(false);
      setConfirmText('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Delete Flashcard Set</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Please type the set name to confirm deletion.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">
              Set name (click to copy):
            </Label>
            <Button
              variant="outline"
              className="w-full justify-between text-left h-auto py-2"
              onClick={handleCopyTitle}
            >
              <span className="font-medium truncate">{setTitle}</span>
              <Copy className="h-4 w-4 ml-2 flex-shrink-0" />
            </Button>
          </div>

          <div>
            <Label htmlFor="confirm">Type set name to confirm *</Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type the set name exactly as shown above"
              className="mt-1.5"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setConfirmText('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText !== setTitle}
            >
              Delete Set
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}