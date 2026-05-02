import { useState } from 'react';
import { ArrowLeft, Plus, Share2, GripVertical, Edit, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FlashcardSet } from '@/types/flashcards';
import { useFlashcardCards } from '@/hooks/useFlashcardCards';
import { AddFlashcardModal } from './AddFlashcardModal';
import { ImportFromVocabularyModal } from './ImportFromVocabularyModal';
import { ShareFlashcardSetModal } from './ShareFlashcardSetModal';

interface FlashcardSetEditorProps {
  set: FlashcardSet;
  onBack: () => void;
  onUpdate: (setId: string, updates: Partial<FlashcardSet>) => Promise<void>;
  generateShareToken: (setId: string) => Promise<string | null>;
  studentNativeLanguage: string;
  teacherCalendarToken?: string | null;
}

export function FlashcardSetEditor({
  set,
  onBack,
  generateShareToken,
  studentNativeLanguage,
  teacherCalendarToken,
}: FlashcardSetEditorProps) {
  const { cards, addCard, updateCard, deleteCard, refetch } = useFlashcardCards(set.id);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(set.share_token);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const handleShare = async () => {
    if (!shareToken) {
      const token = await generateShareToken(set.id);
      setShareToken(token);
    }
    setIsShareModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{set.title}</h2>
          {set.description && (
            <p className="text-muted-foreground">{set.description}</p>
          )}
        </div>
        <Button variant="outline" onClick={handleShare}>
          <Share2 className="w-4 h-4 mr-2" />
          Share
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Card
        </Button>
        <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
          <FileText className="w-4 h-4 mr-2" />
          Import from Worksheet
        </Button>
      </div>

      {cards.length === 0 && (
        <div className="text-center py-12 bg-muted/50 rounded-lg">
          <div className="text-lg font-medium mb-2">No cards yet</div>
          <p className="text-muted-foreground mb-4">
            Add your first flashcard or import from a worksheet
          </p>
        </div>
      )}

      {cards.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{cards.length} cards</Badge>
              <Badge variant="outline" className="text-xs">
                {set.back_type === 'translation' ? '🌐 Native' : '📖 Definition'}
              </Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              English ⇄ {studentNativeLanguage}
            </span>
          </div>

          {cards.map((card) => (
            <Card key={card.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <GripVertical className="w-4 h-4 text-muted-foreground mt-1 flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{card.front_text}</div>
                      {card.cefr_level && (
                        <Badge variant="outline" className="text-xs px-1.5 py-0">
                          {card.cefr_level}
                        </Badge>
                      )}
                    </div>
                    {card.front_example && (
                      <div className="text-sm text-muted-foreground italic mt-1">
                        {card.front_example}
                      </div>
                    )}
                    <div className="text-sm mt-2 text-muted-foreground">
                      → {card.back_text}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingCardId(card.id)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteCard(card.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

        <AddFlashcardModal
        open={isAddModalOpen || !!editingCardId}
        onOpenChange={(open) => {
          setIsAddModalOpen(open);
          if (!open) setEditingCardId(null);
        }}
        setId={set.id}
        onAdd={addCard}
        studentNativeLanguage={studentNativeLanguage}
        backType={set.back_type || 'translation'}
        editingCard={editingCardId ? cards.find(c => c.id === editingCardId) : undefined}
        onUpdate={editingCardId ? (updates) => updateCard(editingCardId, updates) : undefined}
        onCloseEdit={() => setEditingCardId(null)}
      />

      <ImportFromVocabularyModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        setId={set.id}
        studentId={set.student_id}
        backType={set.back_type || 'translation'}
        nativeLanguage={studentNativeLanguage}
        onImportComplete={() => {
          // Refetch cards after import
          refetch();
        }}
      />

      <ShareFlashcardSetModal
        open={isShareModalOpen}
        onOpenChange={setIsShareModalOpen}
        shareToken={shareToken}
        setTitle={set.title}
        studentEmail={set.student_email}
        teacherName={set.teacher_name}
        teacherCalendarToken={teacherCalendarToken}
      />
    </div>
  );
}
