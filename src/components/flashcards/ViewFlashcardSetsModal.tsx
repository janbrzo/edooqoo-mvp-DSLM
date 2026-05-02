import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, Layers, BookOpen, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { useFlashcardSets } from '@/hooks/useFlashcardSets';
import { useFlashcardCards } from '@/hooks/useFlashcardCards';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CreateFlashcardSetModal } from './CreateFlashcardSetModal';
import { CreateFlashcardSet } from '@/types/flashcards';

interface ViewFlashcardSetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  teacherId: string;
  studentName?: string;
}

export const ViewFlashcardSetsModal = ({
  open,
  onOpenChange,
  studentId,
  teacherId,
  studentName
}: ViewFlashcardSetsModalProps) => {
  const { sets, loading, refetch, createSet } = useFlashcardSets(teacherId, studentId);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Fetch cards for expanded set
  const { cards, loading: cardsLoading } = useFlashcardCards(expandedSetId || undefined);
  
  const handleOpenInNewTab = () => {
    window.open(`/student/${studentId}?tab=flashcards`, '_blank');
    onOpenChange(false);
  };
  
  const handleToggleSet = (setId: string) => {
    setExpandedSetId(expandedSetId === setId ? null : setId);
  };
  
  const handleCreateSet = async (data: CreateFlashcardSet) => {
    const result = await createSet(data);
    if (result) {
      refetch();
      setShowCreateModal(false);
    }
    return result;
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-green-600" />
              Flashcard Sets {studentName && <span className="text-muted-foreground font-normal">for {studentName}</span>}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Create New Set Button */}
            <Button 
              onClick={() => setShowCreateModal(true)}
              variant="outline"
              className="w-full border-dashed border-2 border-green-500 hover:bg-green-50 text-green-600"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Set
            </Button>
            
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : sets.length === 0 ? (
              <div className="text-center py-8">
                <Layers className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">No flashcard sets yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create one using the button above
                </p>
              </div>
            ) : (
              <ScrollArea className="max-h-[400px]">
                <div className="space-y-2 pr-2">
                  {sets.map(set => (
                    <div
                      key={set.id}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Set header - clickable to expand */}
                      <div
                        className="p-3 hover:bg-muted/50 transition-colors cursor-pointer flex items-center justify-between"
                        onClick={() => handleToggleSet(set.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{set.title}</h4>
                          {set.description && (
                            <p className="text-sm text-muted-foreground truncate">{set.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <Badge variant="secondary" className="text-xs">
                            <BookOpen className="h-3 w-3 mr-1" />
                            {set.cards_count || 0}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {set.back_type === 'translation' ? 'Native' : 'Definition'}
                          </Badge>
                          {expandedSetId === set.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      
                      {/* Expanded content - show flashcards */}
                      {expandedSetId === set.id && (
                        <div className="border-t bg-muted/20 p-3">
                          {cardsLoading ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          ) : cards.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              No flashcards in this set yet
                            </p>
                          ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {cards.map(card => (
                                <div 
                                  key={card.id} 
                                  className="p-2 bg-background rounded border text-sm"
                                >
                                  <div className="font-medium">{card.front_text}</div>
                                  <div className="text-muted-foreground text-xs mt-1">
                                    → {card.back_text}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
            
            <Button 
              onClick={handleOpenInNewTab}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Flashcards Page in New Tab
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Create Flashcard Set Modal */}
      <CreateFlashcardSetModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        studentId={studentId}
        studentName={studentName || 'Student'}
        onCreate={handleCreateSet}
      />
    </>
  );
};