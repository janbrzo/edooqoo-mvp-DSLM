import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useFlashcardCards } from '@/hooks/useFlashcardCards';
import { normalizeVocabularySheet } from '@/types/flashcards';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface ImportFromVocabularyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setId: string;
  studentId: string;
  backType?: 'translation' | 'definition';
  nativeLanguage?: string;
  onImportComplete?: () => void;
}

export function ImportFromVocabularyModal({
  open,
  onOpenChange,
  setId,
  studentId,
  backType = 'translation',
  nativeLanguage = 'Spanish',
  onImportComplete,
}: ImportFromVocabularyModalProps) {
  const [worksheets, setWorksheets] = useState<any[]>([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState<string | null>(null);
  const [vocabularyItems, setVocabularyItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const { bulkAddFromVocabulary } = useFlashcardCards(setId);

  useEffect(() => {
    if (open) {
      fetchWorksheets();
    }
  }, [open, studentId]);

  const fetchWorksheets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('worksheets')
        .select('id, title, ai_response, created_at')
        .eq('student_id', studentId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter worksheets that have vocabulary_sheet
      const worksheetsWithVocab = data.filter(w => {
        try {
          const parsed = JSON.parse(w.ai_response);
          return parsed.vocabulary_sheet && (
            Array.isArray(parsed.vocabulary_sheet) ||
            (parsed.vocabulary_sheet.words && Array.isArray(parsed.vocabulary_sheet.words))
          );
        } catch {
          return false;
        }
      });

      setWorksheets(worksheetsWithVocab);
    } catch (error) {
      console.error('Error fetching worksheets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWorksheetSelect = (worksheetId: string) => {
    const worksheet = worksheets.find(w => w.id === worksheetId);
    if (!worksheet) return;

    try {
      const parsed = JSON.parse(worksheet.ai_response);
      const normalized = normalizeVocabularySheet(parsed.vocabulary_sheet);
      setVocabularyItems(normalized);
      setSelectedWorksheet(worksheetId);
      setSelectedItems(new Set(normalized.map((_, i) => i)));
    } catch (error) {
      console.error('Error parsing vocabulary:', error);
    }
  };

  const toggleItem = (index: number) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedItems(newSelected);
  };

  const toggleAll = () => {
    if (selectedItems.size === vocabularyItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(vocabularyItems.map((_, i) => i)));
    }
  };

  const handleImport = async () => {
    if (!selectedWorksheet || selectedItems.size === 0) return;

    const worksheet = worksheets.find(w => w.id === selectedWorksheet);
    if (!worksheet) return;

    setLoading(true);
    try {
      const parsed = JSON.parse(worksheet.ai_response);
      const itemsToImport = vocabularyItems.filter((_, i) => selectedItems.has(i));

      // If backType is 'translation', auto-translate definitions
      let processedItems = itemsToImport;
      if (backType === 'translation' && nativeLanguage) {
        console.log('[ImportFromVocabularyModal] Auto-translating to', nativeLanguage);
        
        // Translate each word (term), NOT the definition
        const translationPromises = itemsToImport.map(async (item) => {
          try {
            const { data, error } = await supabase.functions.invoke('translate-flashcard', {
              body: {
                text: item.word,
                target_language: nativeLanguage,
              },
            });
            
            if (error) throw error;
            
            return {
              ...item,
              definition: data?.translation || item.definition,
              cefr_level: data?.cefr_level || undefined,
            };
          } catch (error) {
            console.error('[ImportFromVocabularyModal] Translation error:', error);
            return item;
          }
        });

        processedItems = await Promise.all(translationPromises);
      }
      // For 'definition' mode - use definition as-is, no translation

      // Create vocabulary data in original format for bulkAddFromVocabulary
      const vocabData = Array.isArray(parsed.vocabulary_sheet)
        ? processedItems.map(item => ({ term: item.word, meaning: item.definition }))
        : { title: parsed.vocabulary_sheet.title, words: processedItems };

      await bulkAddFromVocabulary(setId, selectedWorksheet, vocabData);
      onImportComplete?.(); // Trigger refetch
      onOpenChange(false);
      setSelectedWorksheet(null);
      setVocabularyItems([]);
      setSelectedItems(new Set());
    } catch (error) {
      console.error('[ImportFromVocabularyModal] Import error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import from Worksheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!selectedWorksheet && (
            <>
              <p className="text-sm text-muted-foreground">
                Select a worksheet to import vocabulary from:
              </p>
              <ScrollArea className="h-[400px] pr-4">
                {loading && <div className="text-center py-4">Loading...</div>}
                {!loading && worksheets.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    No worksheets with vocabulary found
                  </div>
                )}
                <div className="space-y-2">
                  {worksheets.map((worksheet) => (
                    <Button
                      key={worksheet.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3"
                      onClick={() => handleWorksheetSelect(worksheet.id)}
                    >
                      <div className="flex-1">
                        <div className="font-medium">{worksheet.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {new Date(worksheet.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {selectedWorksheet && (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  {selectedItems.size} / {vocabularyItems.length} selected
                </Badge>
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedItems.size === vocabularyItems.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {vocabularyItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedItems.has(index)}
                        onCheckedChange={() => toggleItem(index)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.word}</div>
                        <div className="text-sm text-muted-foreground">{item.definition}</div>
                        {item.example && (
                          <div className="text-xs text-muted-foreground italic mt-1">
                            {item.example}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="flex justify-between gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedWorksheet(null);
                    setVocabularyItems([]);
                    setSelectedItems(new Set());
                  }}
                >
                  Back
                </Button>
              <Button
                variant="outline"
                onClick={handleImport}
                disabled={selectedItems.size === 0 || loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  `Import ${selectedItems.size} Cards`
                )}
              </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
