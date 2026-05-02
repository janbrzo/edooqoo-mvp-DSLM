import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  NewKnowledgeEntry,
  KnowledgeCategory,
  KnowledgeMetadata,
  KNOWLEDGE_CATEGORIES,
  SKILL_SUBTYPES,
  SKILL_ELEMENT_TYPES,
  PERSONAL_SUBCATEGORIES,
  SkillSubtype,
  SkillElementType,
  PersonalSubCategory,
  parseTagsFromInput,
} from '@/types/studentKnowledge';
import { cn } from '@/lib/utils';

interface StudentKnowledgeQuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: Omit<NewKnowledgeEntry, 'student_id' | 'teacher_id'>) => Promise<void>;
  suggestedTags: string[];
  worksheetId?: string;
}

export const StudentKnowledgeQuickAddModal = ({
  isOpen,
  onClose,
  onAdd,
  suggestedTags,
  worksheetId,
}: StudentKnowledgeQuickAddModalProps) => {
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | null>(null);
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Skill Assessment metadata
  const [skillSubtype, setSkillSubtype] = useState<SkillSubtype>('strength');
  const [elementType, setElementType] = useState<SkillElementType | ''>('');
  const [nanoSkill, setNanoSkill] = useState('');
  const [reason, setReason] = useState('');
  const [mastery, setMastery] = useState<number>(50);

  // Personal metadata
  const [personalSubCategory, setPersonalSubCategory] = useState<PersonalSubCategory>('personal_info');

  const handleAddTag = (tag: string) => {
    const currentTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    if (!currentTags.includes(tag)) {
      const newTagsInput = currentTags.length > 0 
        ? `${tagsInput}, ${tag}`
        : tag;
      setTagsInput(newTagsInput);
    }
  };

  const buildMetadata = (): KnowledgeMetadata | undefined => {
    if (selectedCategory === 'Skill Assessment') {
      return {
        skill_subtype: skillSubtype,
        element_type: elementType || undefined,
        nano_skill: nanoSkill.trim() || undefined,
        reason: reason.trim() || undefined,
        mastery,
      };
    }
    if (selectedCategory === 'Personal') {
      return { sub_category: personalSubCategory };
    }
    return undefined;
  };

  const handleAdd = async () => {
    if (!selectedCategory || !content.trim()) return;

    setIsAdding(true);
    try {
      const newEntry: Omit<NewKnowledgeEntry, 'student_id' | 'teacher_id'> = {
        category: selectedCategory,
        content: content.trim(),
        tags: parseTagsFromInput(tagsInput),
        worksheet_id: worksheetId || null,
        entry_source: worksheetId ? 'worksheet' : 'manual',
        metadata: buildMetadata(),
      };

      await onAdd(newEntry);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Failed to add entry:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const resetForm = () => {
    setSelectedCategory(null);
    setContent('');
    setTagsInput('');
    setSkillSubtype('strength');
    setElementType('');
    setNanoSkill('');
    setReason('');
    setMastery(50);
    setPersonalSubCategory('personal_info');
  };

  const handleClose = () => {
    if (!isAdding) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quick Add Note</DialogTitle>
          <DialogDescription>
            Add a quick note to this student's knowledge base.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Category Grid */}
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

          {/* Skill Assessment extra fields */}
          {selectedCategory === 'Skill Assessment' && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <div className="flex flex-wrap gap-1">
                  {SKILL_SUBTYPES.map((st) => (
                    <Button
                      key={st.id}
                      variant={skillSubtype === st.id ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setSkillSubtype(st.id)}
                    >
                      <span className="mr-1">{st.icon}</span>{st.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Skill Area</Label>
                <div className="flex flex-wrap gap-1">
                  {SKILL_ELEMENT_TYPES.map((et) => (
                    <Button
                      key={et.id}
                      variant={elementType === et.id ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={() => setElementType(elementType === et.id ? '' : et.id)}
                    >
                      {et.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nano Skill <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  value={nanoSkill}
                  onChange={(e) => setNanoSkill(e.target.value)}
                  placeholder="e.g. past simple, phrasal verbs"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reason <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this a strength/weakness?"
                  className="h-8 text-sm"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Mastery</Label>
                  <span className="text-xs font-medium text-muted-foreground">{mastery}%</span>
                </div>
                <Slider
                  value={[mastery]}
                  onValueChange={([v]) => setMastery(v)}
                  min={0} max={100} step={5}
                  className="py-1"
                />
              </div>
            </div>
          )}

          {/* Personal sub-categories */}
          {selectedCategory === 'Personal' && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
              <Label className="text-xs">Sub-category</Label>
              <div className="grid grid-cols-2 gap-1">
                {PERSONAL_SUBCATEGORIES.map((sc) => (
                  <Button
                    key={sc.id}
                    variant={personalSubCategory === sc.id ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs px-2 justify-start"
                    onClick={() => setPersonalSubCategory(sc.id)}
                  >
                    <span className="mr-1">{sc.icon}</span>{sc.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="quick-content">Content *</Label>
            <Textarea
              id="quick-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your note here..."
              rows={selectedCategory === 'Skill Assessment' ? 3 : 6}
              className="resize-none"
            />
          </div>

          {/* Tags with Suggestions */}
          <div className="space-y-2">
            <Label htmlFor="quick-tags">Tags (comma-separated)</Label>
            
            {suggestedTags.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-muted-foreground mb-2">Suggested tags:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedTags.slice(0, 10).map((tag, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => handleAddTag(tag)}
                    >
                      {tag.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Textarea
              id="quick-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., grammar, past_tense, needs_practice"
              rows={1}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isAdding}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedCategory || !content.trim() || isAdding}
          >
            {isAdding ? 'Adding...' : 'Add Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};