import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useFlashcardSets } from '@/hooks/useFlashcardSets';
import { useFlashcardCards } from '@/hooks/useFlashcardCards';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Plus, Globe, BookOpen, Loader2 } from 'lucide-react';
import { NATIVE_LANGUAGES } from '@/types/flashcards';

interface QuickImportToFlashcardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  teacherId: string;
  worksheetId: string;
  vocabularyItems: Array<{
    word: string;
    definition: string;
    example?: string;
  }>;
  nativeLanguage: string;
}

export function QuickImportToFlashcardsModal({
  open,
  onOpenChange,
  studentId,
  teacherId,
  worksheetId,
  vocabularyItems,
  nativeLanguage
}: QuickImportToFlashcardsModalProps) {
  const [step, setStep] = useState<'select-set' | 'create-set' | 'select-items' | 'edit-translations'>('select-set');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [selectedSetBackType, setSelectedSetBackType] = useState<'translation' | 'definition'>('definition');
  const [importing, setImporting] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [cefrLevels, setCefrLevels] = useState<Record<number, string>>({});
  const [translationsLoading, setTranslationsLoading] = useState(0);
  const justOpened = useRef(false);
  
  // New set creation fields
  const [newSetTitle, setNewSetTitle] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [newSetBackType, setNewSetBackType] = useState<'translation' | 'definition'>('translation');
  const [newSetBidirectional, setNewSetBidirectional] = useState(true);
  
  const { sets, refetch, createSet } = useFlashcardSets(teacherId, studentId);
  const { bulkAddFromVocabulary } = useFlashcardCards(selectedSetId || undefined);

  const studentSets = sets;

  // FIX PROBLEM 3: Remove vocabularyItems from dependency to prevent checkbox re-renders
  useEffect(() => {
    if (open && !justOpened.current) {
      justOpened.current = true;
      refetch();
      // Pre-select all items when modal opens
      setSelectedItems(new Set(vocabularyItems.map((_, i) => i)));
    }
    if (!open) {
      justOpened.current = false;
    }
  }, [open, teacherId, refetch]);

  const toggleItem = (index: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedItems.size === vocabularyItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(vocabularyItems.map((_, i) => i)));
    }
  };

  const handleSetSelected = async (setId: string) => {
    setSelectedSetId(setId);
    
    // Find the selected set to check its back_type
    const selectedSet = studentSets.find(s => s.id === setId);
    const backType = selectedSet?.back_type || 'definition';
    setSelectedSetBackType(backType as 'translation' | 'definition');
    
    // If single item, import immediately or go to translation step
    if (vocabularyItems.length === 1) {
      // For translation sets, go to edit-translations step with auto-fetch
      if (backType === 'translation') {
        setStep('edit-translations');
        // FIX PROBLEM 3A: Auto-fetch translation for single item
        await fetchSingleTranslation(0);
      } else {
        handleImport(setId);
      }
    } else {
      // Multiple items - show selection step
      setStep('select-items');
    }
  };

  const handleNewSetClick = () => {
    setStep('create-set');
  };

  const handleCreateSet = async () => {
    if (!newSetTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a title for the new flashcard set",
        variant: "destructive"
      });
      return;
    }

    const newSet = await createSet({
      student_id: studentId,
      title: newSetTitle.trim(),
      description: newSetDescription.trim() || undefined,
      is_bidirectional: newSetBidirectional,
      back_type: newSetBackType,
    });

    if (!newSet) {
      toast({
        title: "Error",
        description: "Failed to create flashcard set",
        variant: "destructive"
      });
      return;
    }

    setSelectedSetId(newSet.id);
    setSelectedSetBackType(newSetBackType);
    
    // If single item, import immediately
    if (vocabularyItems.length === 1) {
      // For translation sets, go to edit-translations step
      if (newSetBackType === 'translation') {
        setStep('edit-translations');
      } else {
        handleImport(newSet.id);
      }
    } else {
      // Multiple items - show selection step
      setStep('select-items');
    }
  };

  // FIX PROBLEM 5: Close modal immediately, import in background
  const handleImport = async (targetSetId?: string) => {
    const setIdToUse = targetSetId || selectedSetId;
    if (!setIdToUse) return;
    
    // Close modal immediately
    onOpenChange(false);
    
    // Save items to import before resetting
    const itemsToImport = vocabularyItems.filter((_, index) => selectedItems.has(index));
    
    // FIX PROBLEM 2: Map translations back to items - correct index mapping
    const processedItems = selectedSetBackType === 'translation'
      ? itemsToImport.map((item) => {
          // Find original index by matching word and definition
          const originalIndex = vocabularyItems.findIndex(v => 
            v.word === item.word && v.definition === item.definition
          );
          return {
            ...item,
            definition: translations[originalIndex] || item.definition
          };
        })
      : itemsToImport;
    
    resetModal();
    
    // Import in background
    setImporting(true);
    try {
      await bulkAddFromVocabulary(
        setIdToUse,
        worksheetId,
        processedItems
      );

      toast({
        title: "Success",
        description: `${processedItems.length} word(s) added to flashcards!`
      });
    } catch (error: any) {
      console.error('Error importing to flashcards:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to import vocabulary",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  const resetModal = () => {
    setStep('select-set');
    setSelectedSetId(null);
    setSelectedSetBackType('definition');
    setSelectedItems(new Set());
    setTranslations({});
    setCefrLevels({});
    setTranslationsLoading(0);
    setNewSetTitle('');
    setNewSetDescription('');
    setNewSetBackType('translation');
    setNewSetBidirectional(true);
  };

  const handleProceedToTranslations = async () => {
    setStep('edit-translations');
    
    // Trigger auto-translation for each selected item
    const itemsToTranslate = vocabularyItems.filter((_, index) => selectedItems.has(index));
    
    // Set loading count
    setTranslationsLoading(itemsToTranslate.length);
    
    // Bulk translate using direct Supabase call
    // FIX PROBLEM 3B: Translate word (term) instead of definition
    for (const item of itemsToTranslate) {
      const originalIndex = vocabularyItems.findIndex(v => v.word === item.word && v.definition === item.definition);
      
      try {
        const { data, error } = await supabase.functions.invoke('translate-flashcard', {
          body: {
            text: item.word,
            target_language: nativeLanguage,
          },
        });

        if (!error && data?.translation) {
          setTranslations(prev => ({ ...prev, [originalIndex]: data.translation }));
        }
        if (data?.cefr_level) {
          setCefrLevels(prev => ({ ...prev, [originalIndex]: data.cefr_level }));
        }
      } catch (error) {
        console.error('Translation error for:', item.word, error);
        // Fallback to original word
        setTranslations(prev => ({ ...prev, [originalIndex]: item.word }));
      } finally {
        // Decrement loading count
        setTranslationsLoading(prev => Math.max(0, prev - 1));
      }
    }
  };

  // Helper function for single item translation (FIX PROBLEM 3A)
  const fetchSingleTranslation = async (index: number) => {
    const item = vocabularyItems[index];
    if (!item) return;

    try {
      const { data, error } = await supabase.functions.invoke('translate-flashcard', {
        body: {
          text: item.word,
          target_language: nativeLanguage,
        },
      });

      if (!error && data?.translation) {
        setTranslations(prev => ({ ...prev, [index]: data.translation }));
      }
      if (data?.cefr_level) {
        setCefrLevels(prev => ({ ...prev, [index]: data.cefr_level }));
      }
    } catch (error) {
      console.error('Translation error for:', item.word, error);
      setTranslations(prev => ({ ...prev, [index]: item.word }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        resetModal();
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'select-set' && 'Add to Flashcards'}
            {step === 'create-set' && 'Create New Flashcard Set'}
            {step === 'select-items' && 'Select Vocabulary Items'}
            {step === 'edit-translations' && 'Edit Translations'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select-set' && 'Choose an existing flashcard set or create a new one'}
            {step === 'create-set' && 'Set up your new flashcard set'}
            {step === 'select-items' && `Select which items to add (${selectedItems.size} of ${vocabularyItems.length} selected)`}
            {step === 'edit-translations' && `Review and edit translations to ${nativeLanguage}`}
          </DialogDescription>
        </DialogHeader>

        {step === 'select-set' && (
          <div className="space-y-4 py-4">
            <Label className="text-base font-semibold">Select a Flashcard Set</Label>
            
            {/* Existing sets as tiles - FIX PROBLEM 2 */}
            <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
              {/* FIX PROBLEM 2: New Set Button FIRST, smaller tiles */}
              <Button
                variant={selectedSetId === 'new' ? 'default' : 'outline'}
                className="h-auto p-2 flex flex-col items-center justify-center min-h-[65px]"
                onClick={() => {
                  setSelectedSetId('new');
                  setStep('create-set');
                }}
              >
                <Plus className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">New Set</span>
              </Button>
              
              {studentSets.map(set => (
                <Button
                  key={set.id}
                  variant={selectedSetId === set.id ? 'default' : 'outline'}
                  className="h-auto p-2 flex flex-col items-start text-left min-h-[65px] justify-between"
                  onClick={() => handleSetSelected(set.id)}
                >
                  <div className="font-semibold text-xs mb-1 line-clamp-2 w-full">{set.title}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 w-full">
                    <span>{set.cards_count || 0} cards</span>
                    <span>•</span>
                    {set.back_type === 'translation' ? (
                      <span className="flex items-center gap-1"><Globe className="w-2.5 h-2.5" /> Native</span>
                    ) : (
                      <span className="flex items-center gap-1"><BookOpen className="w-2.5 h-2.5" /> Definition</span>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </div>
        )}

        {step === 'create-set' && (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-title">Title *</Label>
              <Input
                id="new-title"
                value={newSetTitle}
                onChange={(e) => setNewSetTitle(e.target.value)}
                placeholder="e.g., Business English Vocabulary"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-description">Description (optional)</Label>
              <Textarea
                id="new-description"
                value={newSetDescription}
                onChange={(e) => setNewSetDescription(e.target.value)}
                placeholder="What topics does this set cover?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Back Side Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setNewSetBackType('translation')}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg transition-colors ${
                    newSetBackType === 'translation' 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Globe className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Translation</div>
                    <div className="text-xs text-muted-foreground">Native language</div>
                  </div>
                </button>
                <button
                  onClick={() => setNewSetBackType('definition')}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg transition-colors ${
                    newSetBackType === 'definition' 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-medium text-sm">Definition</div>
                    <div className="text-xs text-muted-foreground">English only</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="bidirectional" className="cursor-pointer">Bidirectional Learning</Label>
                <p className="text-xs text-muted-foreground">Practice both EN→{nativeLanguage} and {nativeLanguage}→EN</p>
              </div>
              <Switch
                id="bidirectional"
                checked={newSetBidirectional}
                onCheckedChange={setNewSetBidirectional}
              />
            </div>
          </div>
        )}

        {step === 'select-items' && (
          <div className="space-y-4 py-4">
            {/* Select All / Deselect All */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  toggleAll();
                }}
              >
                {selectedItems.size === vocabularyItems.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {/* Vocabulary items with checkboxes - REDUCED HEIGHT */}
            <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
              {vocabularyItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggleItem(index)}
                >
                  <Checkbox
                    checked={selectedItems.has(index)}
                    onCheckedChange={() => toggleItem(index)}
                    className="mt-1"
                  />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{item.word}</div>
                    <div className="text-muted-foreground">{item.definition}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FIX PROBLEM 6: Edit Translations Step */}
        {step === 'edit-translations' && (
          <div className="space-y-4 py-4">
            <div className="text-sm text-muted-foreground mb-3">
              Review and edit the translations before adding to your flashcard set
            </div>
            
            <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
              {vocabularyItems
                .filter((_, index) => selectedItems.has(index))
                .map((item, displayIndex) => {
                  const originalIndex = vocabularyItems.findIndex(v => v.word === item.word && v.definition === item.definition);
                  return (
                    <div key={originalIndex} className="p-3 space-y-2">
                      <div className="font-medium text-sm">{item.word}</div>
                      <div className="text-xs text-muted-foreground mb-2">{item.definition}</div>
                      <div className="space-y-1">
                        <Label htmlFor={`translation-${originalIndex}`} className="text-xs">
                          Translation ({nativeLanguage})
                        </Label>
                        <div className="relative">
                          <Input
                            id={`translation-${originalIndex}`}
                            value={translations[originalIndex] || ''}
                            onChange={(e) => setTranslations(prev => ({ ...prev, [originalIndex]: e.target.value }))}
                            placeholder={`Enter ${nativeLanguage} translation`}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          {step === 'create-set' && (
            <Button
              variant="outline"
              onClick={() => setStep('select-set')}
            >
              Back
            </Button>
          )}
          {step === 'select-items' && (
            <Button
              variant="outline"
              onClick={() => setStep('select-set')}
            >
              Back
            </Button>
          )}
          {step === 'edit-translations' && (
            <Button
              variant="outline"
              onClick={() => setStep('select-items')}
            >
              Back
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={importing}
          >
            Cancel
          </Button>
          {step === 'select-set' && null}
          {step === 'create-set' && (
            <Button
              onClick={handleCreateSet}
              disabled={!newSetTitle.trim()}
            >
              Create & Continue
            </Button>
          )}
          {step === 'select-items' && (
            <Button
              onClick={() => {
                // For translation sets, go to edit-translations
                if (selectedSetBackType === 'translation') {
                  handleProceedToTranslations();
                } else {
                  handleImport();
                }
              }}
              disabled={importing || selectedItems.size === 0}
            >
              {selectedSetBackType === 'translation' 
                ? 'Next: Edit Translations' 
                : (importing 
                    ? 'Importing...' 
                    : `Send ${selectedItems.size} Card${selectedItems.size !== 1 ? 's' : ''}`)
              }
            </Button>
          )}
          {step === 'edit-translations' && (
            <Button
              onClick={() => handleImport()}
              disabled={importing || selectedItems.size === 0 || translationsLoading > 0}
            >
              {translationsLoading > 0
                ? `Translating... (${translationsLoading} remaining)`
                : importing 
                  ? 'Importing...' 
                  : `Send ${selectedItems.size} Card${selectedItems.size !== 1 ? 's' : ''}`
              }
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
