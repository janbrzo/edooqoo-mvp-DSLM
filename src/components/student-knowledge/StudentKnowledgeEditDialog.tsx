import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  StudentKnowledgeEntry,
  UpdateKnowledgeEntry,
  KnowledgeCategory,
  KNOWLEDGE_CATEGORIES,
  parseTagsFromInput,
} from '@/types/studentKnowledge';

interface StudentKnowledgeEditDialogProps {
  entry: StudentKnowledgeEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (entryId: string, updates: UpdateKnowledgeEntry) => Promise<void>;
}

export const StudentKnowledgeEditDialog = ({
  entry,
  isOpen,
  onClose,
  onSave,
}: StudentKnowledgeEditDialogProps) => {
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | null>(null);
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form when entry changes
  useEffect(() => {
    if (entry) {
      setSelectedCategory(entry.category);
      setContent(entry.content);
      setTagsInput(entry.tags?.join(', ') || '');
    }
  }, [entry]);

  const handleSave = async () => {
    if (!entry || !selectedCategory || !content.trim()) return;

    setIsSaving(true);
    try {
      const updates: UpdateKnowledgeEntry = {
        category: selectedCategory,
        content: content.trim(),
        tags: parseTagsFromInput(tagsInput),
      };

      await onSave(entry.id, updates);
      onClose();
    } catch (error) {
      console.error('Failed to save entry:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Knowledge Entry</DialogTitle>
          <DialogDescription>
            Update the category, content, or tags for this note.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category Grid - 3x3 */}
          <div className="space-y-2">
            <Label>Category *</Label>
            <div className="grid grid-cols-3 gap-2">
              {KNOWLEDGE_CATEGORIES.map((cat) => (
                <Button
                  key={cat.id}
                  type="button"
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="h-auto py-2 px-3 flex flex-row items-center gap-2 justify-start"
                >
                  <span className="text-lg">{cat.icon}</span>
                  <span className="text-xs leading-tight">{cat.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="edit-content">Content *</Label>
            <Textarea
              id="edit-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your note here..."
              rows={6}
              className="resize-none"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="edit-tags">Tags (comma-separated)</Label>
            <Textarea
              id="edit-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., grammar, past_tense, needs_practice"
              rows={1}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Separate tags with commas. They will be automatically formatted.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedCategory || !content.trim() || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
