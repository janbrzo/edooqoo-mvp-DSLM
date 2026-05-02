import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  StudentKnowledgeEntry,
  UpdateKnowledgeEntry,
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
  formatTagForDisplay,
} from '@/types/studentKnowledge';
import { cn } from '@/lib/utils';

type PanelMode = 'add' | 'view' | 'edit';

interface StudentKnowledgeSidePanelProps {
  mode: PanelMode;
  isOpen: boolean;
  onClose: () => void;
  entry?: StudentKnowledgeEntry | null;
  studentId: string;
  teacherId: string;
  studentName: string;
  worksheetId?: string;
  onSave: (data: NewKnowledgeEntry | { entryId: string; updates: UpdateKnowledgeEntry }) => Promise<void>;
  suggestedTags?: string[];
  onEdit?: () => void;
}

export const StudentKnowledgeSidePanel = ({
  mode,
  isOpen,
  onClose,
  entry,
  studentId,
  teacherId,
  studentName,
  worksheetId,
  onSave,
  suggestedTags = [],
  onEdit,
}: StudentKnowledgeSidePanelProps) => {
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory>('Goals');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Skill Assessment metadata
  const [skillSubtype, setSkillSubtype] = useState<SkillSubtype>('strength');
  const [elementType, setElementType] = useState<SkillElementType | ''>('');
  const [nanoSkill, setNanoSkill] = useState('');
  const [reason, setReason] = useState('');
  const [mastery, setMastery] = useState<number>(50);

  // Personal metadata
  const [personalSubCategory, setPersonalSubCategory] = useState<PersonalSubCategory>('personal_info');

  useEffect(() => {
    if (mode === 'edit' && entry) {
      setSelectedCategory(entry.category);
      setContent(entry.content);
      setTagsInput(entry.tags?.map(formatTagForDisplay).join(', ') || '');
      const meta = entry.metadata || {};
      setSkillSubtype(meta.skill_subtype || 'strength');
      setElementType(meta.element_type || '');
      setNanoSkill(meta.nano_skill || '');
      setReason(meta.reason || '');
      setMastery(meta.mastery ?? 50);
      setPersonalSubCategory(meta.sub_category || 'personal_info');
    } else if (mode === 'view' && entry) {
      setSelectedCategory(entry.category);
      setContent(entry.content);
      setTagsInput(entry.tags?.map(formatTagForDisplay).join(', ') || '');
      const meta = entry.metadata || {};
      setSkillSubtype(meta.skill_subtype || 'strength');
      setElementType(meta.element_type || '');
      setNanoSkill(meta.nano_skill || '');
      setReason(meta.reason || '');
      setMastery(meta.mastery ?? 50);
      setPersonalSubCategory(meta.sub_category || 'personal_info');
    } else if (mode === 'add') {
      setSelectedCategory('Goals');
      setContent('');
      setTagsInput('');
      setSkillSubtype('strength');
      setElementType('');
      setNanoSkill('');
      setReason('');
      setMastery(50);
      setPersonalSubCategory('personal_info');
    }
  }, [mode, entry]);

  const buildMetadata = (): KnowledgeMetadata | undefined => {
    if (selectedCategory === 'Skill Assessment') {
      return {
        skill_subtype: skillSubtype,
        element_type: elementType || undefined,
        nano_skill: nanoSkill.trim() || undefined,
        reason: reason.trim() || undefined,
        mastery: mastery,
      };
    }
    if (selectedCategory === 'Personal') {
      return { sub_category: personalSubCategory };
    }
    return undefined;
  };

  const handleSave = async () => {
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      const tags = parseTagsFromInput(tagsInput);
      const metadata = buildMetadata();

      if (mode === 'edit' && entry) {
        await onSave({
          entryId: entry.id,
          updates: {
            category: selectedCategory,
            content: content.trim(),
            tags,
            metadata,
          },
        });
      } else if (mode === 'add') {
        const newEntry: NewKnowledgeEntry = {
          student_id: studentId,
          teacher_id: teacherId,
          category: selectedCategory,
          content: content.trim(),
          tags,
          worksheet_id: worksheetId || null,
          entry_source: worksheetId ? 'worksheet' : 'manual',
          metadata,
        };
        await onSave(newEntry);
      }

      onClose();
    } catch (error) {
      console.error('Error saving entry:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  const isReadOnly = mode === 'view';
  const categoryMetadata = KNOWLEDGE_CATEGORIES.find((c) => c.id === selectedCategory);

  const getTitle = () => {
    if (mode === 'add') return `Add Note for ${studentName}`;
    if (mode === 'edit') return `Edit Note for ${studentName}`;
    return `Note for ${studentName}`;
  };

  const getDescription = () => {
    if (mode === 'add') return 'Add a new knowledge entry for this student';
    if (mode === 'edit') return 'Update the knowledge entry';
    return 'View knowledge entry details';
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{getTitle()}</SheetTitle>
          <SheetDescription>{getDescription()}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-140px)] pr-4 mt-4">
          <div className="space-y-4">
            {/* Category Selection */}
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="grid grid-cols-3 gap-1">
                {KNOWLEDGE_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <Button
                      key={cat.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={cn(
                        'h-auto flex items-center gap-1 px-2 py-1.5',
                        isSelected && 'ring-2 ring-ring',
                        isReadOnly && 'pointer-events-none opacity-60'
                      )}
                      onClick={() => !isReadOnly && setSelectedCategory(cat.id)}
                      disabled={isReadOnly}
                    >
                      <span className="text-base">{cat.icon}</span>
                      <span className="text-xs font-medium leading-tight">{cat.label}</span>
                    </Button>
                  );
                })}
              </div>
              {categoryMetadata && (
                <p className="text-xs text-muted-foreground">{categoryMetadata.description}</p>
              )}
            </div>

            {/* Skill Assessment extra fields */}
            {selectedCategory === 'Skill Assessment' && (
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg border">
                {/* Skill Subtype */}
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <div className="flex flex-wrap gap-1">
                    {SKILL_SUBTYPES.map((st) => (
                      <Button
                        key={st.id}
                        variant={skillSubtype === st.id ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={() => !isReadOnly && setSkillSubtype(st.id)}
                        disabled={isReadOnly}
                      >
                        <span className="mr-1">{st.icon}</span>
                        {st.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Element Type */}
                <div className="space-y-1">
                  <Label className="text-xs">Skill Area</Label>
                  <div className="flex flex-wrap gap-1">
                    {SKILL_ELEMENT_TYPES.map((et) => (
                      <Button
                        key={et.id}
                        variant={elementType === et.id ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 text-xs px-2"
                        onClick={() => !isReadOnly && setElementType(elementType === et.id ? '' : et.id)}
                        disabled={isReadOnly}
                      >
                        {et.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Nano Skill */}
                <div className="space-y-1">
                  <Label className="text-xs">Nano Skill <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={nanoSkill}
                    onChange={(e) => setNanoSkill(e.target.value)}
                    placeholder="e.g. past simple, phrasal verbs"
                    className="h-8 text-sm"
                    disabled={isReadOnly}
                  />
                </div>

                {/* Reason */}
                <div className="space-y-1">
                  <Label className="text-xs">Reason <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why is this a strength/weakness?"
                    className="h-8 text-sm"
                    disabled={isReadOnly}
                  />
                </div>

                {/* Mastery Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Mastery</Label>
                    <span className="text-xs font-medium text-muted-foreground">{mastery}%</span>
                  </div>
                  <Slider
                    value={[mastery]}
                    onValueChange={([v]) => setMastery(v)}
                    min={0}
                    max={100}
                    step={5}
                    disabled={isReadOnly}
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
                      onClick={() => !isReadOnly && setPersonalSubCategory(sc.id)}
                      disabled={isReadOnly}
                    >
                      <span className="mr-1">{sc.icon}</span>
                      {sc.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="space-y-1">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your note here..."
                className={cn(
                  "resize-none",
                  selectedCategory === 'Skill Assessment' ? 'min-h-[60px]' : 'min-h-[100px]'
                )}
                disabled={isReadOnly}
                readOnly={isReadOnly}
              />
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <Label htmlFor="tags">
                Tags <span className="text-xs text-muted-foreground">(comma separated)</span>
              </Label>
              <Textarea
                id="tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g., past simple, pronunciation"
                className="min-h-[36px] max-h-[36px] resize-none"
                rows={1}
                disabled={isReadOnly}
                readOnly={isReadOnly}
              />
              {!isReadOnly && suggestedTags.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Suggested:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestedTags.slice(0, 8).map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent text-xs"
                        onClick={() => {
                          const currentTags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
                          const displayTag = formatTagForDisplay(tag);
                          if (!currentTags.includes(displayTag)) {
                            setTagsInput(currentTags.length > 0 ? `${tagsInput}, ${displayTag}` : displayTag);
                          }
                        }}
                      >
                        {formatTagForDisplay(tag)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Metadata (for view/edit modes) */}
            {entry && mode !== 'add' && (
              <div className="space-y-2 pt-3 border-t">
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(entry.created_at).toLocaleDateString('en-US', {
                      year: 'numeric', month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                  {entry.updated_at && entry.updated_at !== entry.created_at && (
                    <p>
                      <span className="font-medium">Updated:</span>{' '}
                      {new Date(entry.updated_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                  <p>
                    <span className="font-medium">Source:</span>{' '}
                    {entry.entry_source === 'worksheet' ? 'Added from worksheet' : 'Manually added'}
                  </p>
                  {entry.is_outdated && (
                    <p className="text-destructive">
                      <span className="font-medium">Status:</span> Outdated
                      {entry.outdated_reason && ` - ${entry.outdated_reason}`}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>
              {isReadOnly ? 'Close' : 'Cancel'}
            </Button>
            {mode === 'view' && onEdit && (
              <Button onClick={onEdit}>Edit Note</Button>
            )}
            {!isReadOnly && (
              <Button onClick={handleSave} disabled={isSaving || !content.trim()}>
                {isSaving ? 'Saving...' : 'Save Note'}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};