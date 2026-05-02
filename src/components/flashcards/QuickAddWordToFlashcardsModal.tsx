import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, ArrowRight, Check, Plus, Globe, BookOpen } from 'lucide-react';
import { useFlashcardSets } from '@/hooks/useFlashcardSets';
import { useFlashcardCards } from '@/hooks/useFlashcardCards';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QuickAddWordToFlashcardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  teacherId: string;
  worksheetId?: string;
  nativeLanguage?: string;
  initialWord?: string;
}

export const QuickAddWordToFlashcardsModal = ({
  open,
  onOpenChange,
  studentId,
  teacherId,
  worksheetId,
  nativeLanguage = 'Spanish',
  initialWord = ''
}: QuickAddWordToFlashcardsModalProps) => {
  // PROBLEM 4 FIX: Combined 'enter-word' and 'edit-translation' into single step
  const [step, setStep] = useState<'select-set' | 'create-set' | 'enter-word'>('select-set');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [selectedSetBackType, setSelectedSetBackType] = useState<'translation' | 'definition'>('definition');
  const [word, setWord] = useState(initialWord);
  const [translation, setTranslation] = useState('');
  const [cefrLevel, setCefrLevel] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // New set creation fields
  const [newSetTitle, setNewSetTitle] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [newSetBackType, setNewSetBackType] = useState<'translation' | 'definition'>('translation');
  const [newSetBidirectional, setNewSetBidirectional] = useState(true);
  
  const { sets, loading: setsLoading, createSet, refetch } = useFlashcardSets(teacherId, studentId);
  const { addCard } = useFlashcardCards(selectedSetId || '');
  
  // Ref to prevent multiple refetch calls on re-renders (fixes flickering modal issue)
  const justOpened = useRef(false);
  
  // Reset state when modal opens - using useRef to prevent infinite loop
  useEffect(() => {
    if (open && !justOpened.current) {
      justOpened.current = true;
      setStep('select-set');
      setSelectedSetId(null);
      setSelectedSetBackType('definition');
      setWord(initialWord);
      setTranslation('');
      setNewSetTitle('');
      setNewSetDescription('');
      setNewSetBackType('translation');
      setNewSetBidirectional(true);
      refetch();
    }
    if (!open) {
      justOpened.current = false;
    }
  }, [open, initialWord, refetch]);
  
  // Auto-translate when word changes (debounced effect)
  const fetchTranslationForWord = async (wordToTranslate: string, backType: 'translation' | 'definition') => {
    if (!wordToTranslate.trim()) return;
    
    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-flashcard', {
        body: {
          text: wordToTranslate.trim(),
          target_language: backType === 'translation' ? nativeLanguage : 'English definition',
          mode: backType === 'definition' ? 'definition' : 'translation',
        }
      });
      
      if (error) throw error;
      setTranslation(data?.translation || '');
      setCefrLevel(data?.cefr_level || null);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };
  
  const handleSetSelected = async (setId: string) => {
    setSelectedSetId(setId);
    
    const selectedSet = sets.find(s => s.id === setId);
    const backType = selectedSet?.back_type || 'definition';
    setSelectedSetBackType(backType as 'translation' | 'definition');
    
    // PROBLEM 4 FIX: Always go to 'enter-word' step (which now includes translation)
    setStep('enter-word');
    
    // If we already have a word (from selection mode), auto-translate it
    if (word.trim()) {
      fetchTranslationForWord(word.trim(), backType as 'translation' | 'definition');
    }
  };
  
  const handleCreateSet = async () => {
    if (!newSetTitle.trim()) {
      toast.error('Please enter a title for the new flashcard set');
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
      toast.error('Failed to create flashcard set');
      return;
    }

    setSelectedSetId(newSet.id);
    setSelectedSetBackType(newSetBackType);
    
    // PROBLEM 4 FIX: Always go to 'enter-word' step (which now includes translation)
    setStep('enter-word');
    
    // If we already have a word, auto-translate it
    if (word.trim()) {
      fetchTranslationForWord(word.trim(), newSetBackType);
    }
  };
  
  // PROBLEM 4 FIX: Trigger auto-translation when word is entered
  const handleWordBlur = async () => {
    if (!word.trim() || translation.trim()) return; // Don't re-translate if translation exists
    fetchTranslationForWord(word.trim(), selectedSetBackType);
  };
  
  const handleSave = async () => {
    if (!selectedSetId || !word.trim() || !translation.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    
    setIsSaving(true);
    try {
      await addCard({
        set_id: selectedSetId,
        front_text: word.trim(),
        back_text: translation.trim(),
        source_type: 'manual',
        source_worksheet_id: worksheetId,
        cefr_level: cefrLevel || undefined,
      });
      
      toast.success('Word added to flashcards!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding card:', error);
      toast.error('Failed to add word to flashcards');
    } finally {
      setIsSaving(false);
    }
  };
  
  const selectedSet = sets.find(s => s.id === selectedSetId);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-600" />
            {step === 'select-set' && 'Add to Flashcards'}
            {step === 'create-set' && 'Create New Flashcard Set'}
            {step === 'enter-word' && 'Add Word to Flashcards'}
            <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Press F</span>
          </DialogTitle>
          <DialogDescription>
            {step === 'select-set' && 'Choose an existing flashcard set or create a new one'}
            {step === 'create-set' && 'Set up your new flashcard set'}
            {step === 'enter-word' && `Enter the word and ${selectedSetBackType === 'translation' ? 'translation' : 'definition'}`}
          </DialogDescription>
        </DialogHeader>
        
        {/* Step 1: Select Set */}
        {step === 'select-set' && (
          <div className="space-y-4 py-4">
            <Label className="text-base font-semibold">Select a Flashcard Set</Label>
            
            {setsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {/* New Set Button FIRST */}
                <Button
                  variant="outline"
                  className="h-auto p-2 flex flex-col items-center justify-center min-h-[65px] border-dashed border-2 border-green-500 hover:bg-green-50"
                  onClick={() => setStep('create-set')}
                >
                  <Plus className="w-5 h-5 mb-1 text-green-600" />
                  <span className="text-xs font-medium text-green-600">New Set</span>
                </Button>
                
                {sets.map(set => (
                  <Button
                    key={set.id}
                    variant="outline"
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
            )}
          </div>
        )}
        
        {/* Step 2: Create Set */}
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
                <p className="text-xs text-muted-foreground">Practice both directions</p>
              </div>
              <Switch
                id="bidirectional"
                checked={newSetBidirectional}
                onCheckedChange={setNewSetBidirectional}
              />
            </div>
            
            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep('select-set')}>
                Back
              </Button>
              <Button 
                onClick={handleCreateSet}
                disabled={!newSetTitle.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                Create & Continue
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: Enter Word AND Translation (PROBLEM 4 FIX: Combined into one step) */}
        {step === 'enter-word' && (
          <div className="space-y-4 py-4">
            <div className="p-3 bg-muted rounded-lg text-sm">
              Adding to: <strong>{selectedSet?.title}</strong>
              <span className="ml-2 text-muted-foreground">
                ({selectedSetBackType === 'translation' ? `→ ${nativeLanguage}` : '→ Definition'})
              </span>
            </div>
            
            {/* Word input */}
            <div>
              <Label>Word or phrase</Label>
              <Textarea
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onBlur={handleWordBlur}
                placeholder="Enter the word or phrase..."
                className="mt-1"
                rows={2}
                autoFocus
              />
            </div>
            
            {/* Translation input - shown together with word */}
            <div>
              <Label>
                {selectedSetBackType === 'translation' 
                  ? `Translation (${nativeLanguage})` 
                  : 'English Definition'}
              </Label>
              {isTranslating ? (
                <div className="flex items-center gap-2 mt-1 p-2 bg-muted rounded">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Auto-translating...</span>
                </div>
              ) : (
                <Textarea
                  value={translation}
                  onChange={(e) => setTranslation(e.target.value)}
                  placeholder={`Enter ${selectedSetBackType === 'translation' ? 'translation' : 'definition'}...`}
                  className="mt-1"
                  rows={2}
                />
              )}
            </div>
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep('select-set')}>
                Back
              </Button>
              <Button 
                onClick={handleSave}
                disabled={isSaving || isTranslating || !word.trim() || !translation.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSaving ? (
                  <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Check className="mr-1 h-4 w-4" /> Add to Flashcards</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
