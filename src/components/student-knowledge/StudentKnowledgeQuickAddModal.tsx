import { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sparkles } from 'lucide-react';
import { NewKnowledgeEntry, parseTagsFromInput } from '@/types/studentKnowledge';

interface StudentKnowledgeQuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: Omit<NewKnowledgeEntry, 'student_id' | 'teacher_id'>) => Promise<void>;
  suggestedTags: string[];
  worksheetId?: string;
}

/**
 * v6.9.8 — Frictionless capture.
 * Teacher writes free text; AI classifies in the background after Save
 * (handled by useStudentKnowledge.addEntry → classify-knowledge-entry).
 * Optional tags only. No category picker.
 */
export const StudentKnowledgeQuickAddModal = ({
  isOpen, onClose, onAdd, suggestedTags, worksheetId,
}: StudentKnowledgeQuickAddModalProps) => {
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddTag = (tag: string) => {
    const current = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (!current.includes(tag)) {
      setTagsInput(current.length ? `${tagsInput}, ${tag}` : tag);
    }
  };

  const reset = () => {
    setContent('');
    setTagsInput('');
  };

  const handleClose = () => {
    if (!isAdding) {
      reset();
      onClose();
    }
  };

  const handleAdd = async () => {
    if (!content.trim()) return;
    setIsAdding(true);
    try {
      await onAdd({
        category: 'Notes', // AI will refine in the background
        content: content.trim(),
        tags: parseTagsFromInput(tagsInput),
        worksheet_id: worksheetId || null,
        entry_source: worksheetId ? 'worksheet' : 'manual',
      });
      reset();
      onClose();
    } catch (e) {
      console.error('Failed to add entry:', e);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Quick Note</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Just write — AI organizes it for you in a moment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="quick-content">What did you notice?</Label>
            <Textarea
              id="quick-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder='e.g. "Struggles with past perfect when telling stories" or "Coming back from Lisbon May 12 — ask about it"'
              rows={5}
              className="resize-none"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quick-tags" className="text-xs text-muted-foreground">
              Tags (optional)
            </Label>
            {suggestedTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestedTags.slice(0, 8).map((tag, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted text-xs"
                    onClick={() => handleAddTag(tag)}
                  >
                    {tag.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            )}
            <Textarea
              id="quick-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="grammar, past_tense"
              rows={1}
              className="resize-none text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isAdding}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!content.trim() || isAdding}>
            {isAdding ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
