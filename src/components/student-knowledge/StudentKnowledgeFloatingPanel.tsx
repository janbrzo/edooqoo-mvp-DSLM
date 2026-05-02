import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

interface StudentKnowledgeFloatingPanelProps {
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
  preSelectedCategory?: KnowledgeCategory;
  hideCategories?: boolean;
}

export const StudentKnowledgeFloatingPanel = ({
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
  preSelectedCategory,
  hideCategories = false,
}: StudentKnowledgeFloatingPanelProps) => {
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
      setSelectedCategory(preSelectedCategory || 'Goals');
      setContent('');
      setTagsInput('');
      setSkillSubtype('strength');
      setElementType('');
      setNanoSkill('');
      setReason('');
      setMastery(50);
      setPersonalSubCategory('personal_info');
    }
  }, [mode, entry, preSelectedCategory]);

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
  const categoryMeta = KNOWLEDGE_CATEGORIES.find((c) => c.id === selectedCategory);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-[480px] max-h-[90vh] shadow-2xl border-2">
        <CardHeader className="border-b py-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                {getTitle()}
                {mode === 'add' && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-normal">Press N</span>
                )}
              </CardTitle>
              <CardDescription className="text-xs">{getDescription()}</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} disabled={isSaving} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <ScrollArea className="h-[calc(90vh-160px)]">
          <CardContent className="pt-4 space-y-4">
            {/* Category Selection */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Category</Label>
              {hideCategories && categoryMeta ? (
                <div className="p-2 bg-muted rounded-lg flex items-center gap-2">
                  <span className="text-lg">{categoryMeta.icon}</span>
                  <div>
                    <span className="font-medium text-sm">{categoryMeta.label}</span>
                    <p className="text-xs text-muted-foreground">{categoryMeta.description}</p>
                  </div>
                </div>
              ) : (
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
              )}
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
                        onClick={() => !isReadOnly && setSkillSubtype(st.id)}
                        disabled={isReadOnly}
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
                        onClick={() => !isReadOnly && setElementType(elementType === et.id ? '' : et.id)}
                        disabled={isReadOnly}
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
                    disabled={isReadOnly}
                  />
                </div>

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

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Mastery</Label>
                    <span className="text-xs font-medium text-muted-foreground">{mastery}%</span>
                  </div>
                  <Slider
                    value={[mastery]}
                    onValueChange={([v]) => setMastery(v)}
                    min={0} max={100} step={5}
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
                      <span className="mr-1">{sc.icon}</span>{sc.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="space-y-1">
              <Label htmlFor="content" className="text-xs">Content</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter your note here..."
                className={cn("resize-none", selectedCategory === 'Skill Assessment' ? 'min-h-[60px]' : 'min-h-[100px]')}
                disabled={isReadOnly}
                readOnly={isReadOnly}
              />
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <Label htmlFor="tags" className="text-xs">
                Tags <span className="text-muted-foreground">(comma separated)</span>
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
                <div className="flex flex-wrap gap-1">
                  {suggestedTags.slice(0, 6).map((tag) => (
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
              )}
            </div>

            {/* Metadata */}
            {entry && mode !== 'add' && (
              <div className="space-y-1 pt-3 border-t">
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><span className="font-medium">Created:</span> {new Date(entry.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  {entry.updated_at && entry.updated_at !== entry.created_at && (
                    <p><span className="font-medium">Updated:</span> {new Date(entry.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  )}
                  <p><span className="font-medium">Source:</span> {entry.entry_source === 'worksheet' ? 'Added from worksheet' : 'Manually added'}</p>
                  {entry.is_outdated && (
                    <p className="text-destructive"><span className="font-medium">Status:</span> Outdated{entry.outdated_reason && ` - ${entry.outdated_reason}`}</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </ScrollArea>

        <div className="border-t p-4 bg-muted/30">
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isSaving}>
              {isReadOnly ? 'Close' : 'Cancel'}
            </Button>
            {mode === 'view' && onEdit && <Button onClick={onEdit}>Edit Note</Button>}
            {!isReadOnly && (
              <Button onClick={handleSave} disabled={isSaving || !content.trim()}>
                {isSaving ? 'Saving...' : 'Save Note'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};