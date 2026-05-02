import { useState } from 'react';
import { Plus, BookOpen, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FlashcardSet, NATIVE_LANGUAGES } from '@/types/flashcards';
import { FlashcardSetCard } from './FlashcardSetCard';
import { CreateFlashcardSetModal } from './CreateFlashcardSetModal';
import { DeleteFlashcardSetModal } from './DeleteFlashcardSetModal';
import { FlashcardSetEditor } from './FlashcardSetEditor';
import { AddFlashcardModal } from './AddFlashcardModal';
import { ShareAllFlashcardSetsModal } from './ShareAllFlashcardSetsModal';
import { useFlashcardSets } from '@/hooks/useFlashcardSets';
import { useFlashcardCards } from '@/hooks/useFlashcardCards';
import { useStudents } from '@/hooks/useStudents';
import { useProfile } from '@/hooks/useProfile';
import { toast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FlashcardSetsSectionProps {
  studentId: string;
  teacherId: string;
  studentName: string;
  studentNativeLanguage: string;
  initialEditingSetId?: string | null;
  onSetChange?: (setId: string | null) => void;
  teacherCalendarToken?: string | null;
}

export function FlashcardSetsSection({
  studentId,
  teacherId,
  studentName,
  studentNativeLanguage,
  initialEditingSetId,
  onSetChange,
  teacherCalendarToken,
}: FlashcardSetsSectionProps) {
  const { sets, loading, createSet, updateSet, deleteSet, generateShareToken, refetch } = useFlashcardSets(teacherId, studentId);
  const { students, updateStudent, loading: studentsLoading } = useStudents();
  const { profile } = useProfile();
  
  // Wait for both data sources to load
  const isLoading = loading || studentsLoading;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSetId, setEditingSetId] = useState<string | null>(initialEditingSetId || null);
  const [deleteSetId, setDeleteSetId] = useState<string | null>(null);
  const [deleteSetTitle, setDeleteSetTitle] = useState<string>('');
  const [addCardForSetId, setAddCardForSetId] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState(studentNativeLanguage);
  const [isShareAllModalOpen, setIsShareAllModalOpen] = useState(false);

  const student = students.find(s => s.id === studentId);

  // Get cards hook for the set we're adding to
  const addCardSet = sets.find(s => s.id === addCardForSetId);
  const { addCard } = useFlashcardCards(addCardForSetId || '');

  const handleDeleteClick = (set: FlashcardSet) => {
    setDeleteSetId(set.id);
    setDeleteSetTitle(set.title);
  };

  const handleConfirmDelete = async () => {
    if (deleteSetId) {
      await deleteSet(deleteSetId);
      setDeleteSetId(null);
      setDeleteSetTitle('');
    }
  };

  const handleLanguageChange = async (newLanguage: string) => {
    try {
      await updateStudent(studentId, { native_language: newLanguage });
      setCurrentLanguage(newLanguage); // Update local state immediately for instant UI update
      toast({
        title: 'Success',
        description: 'Student language updated',
      });
      refetch(); // Refresh sets to reflect new language
    } catch (error) {
      console.error('Error updating language:', error);
      toast({
        title: 'Error',
        description: 'Failed to update language',
        variant: 'destructive',
      });
    }
  };

  // Handle back from editor
  const handleBackFromEditor = () => {
    setEditingSetId(null);
    onSetChange?.(null);
  };

  // Handle opening editor
  const handleOpenEditor = (setId: string) => {
    setEditingSetId(setId);
    onSetChange?.(setId);
  };

  // If editing set, show editor (but only after loading is complete)
  if (editingSetId && !isLoading) {
    const set = sets.find(s => s.id === editingSetId);
    if (set) {
      return (
        <FlashcardSetEditor
          set={set}
          onBack={handleBackFromEditor}
          onUpdate={updateSet}
          generateShareToken={generateShareToken}
          studentNativeLanguage={currentLanguage || studentNativeLanguage}
          teacherCalendarToken={teacherCalendarToken}
        />
      );
    }
    // Set not found - clear editingSetId and show list
    setEditingSetId(null);
    onSetChange?.(null);
  }

  const selectedLanguage = NATIVE_LANGUAGES.find(
    lang => lang.value === (currentLanguage || studentNativeLanguage || 'Spanish')
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-2xl font-semibold">Flashcard Sets for {studentName || 'Student'}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select 
            value={currentLanguage || studentNativeLanguage || 'Spanish'}
            onValueChange={handleLanguageChange}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedLanguage?.flag || '🌐'}</span>
                  <span>{selectedLanguage?.label || 'Spanish'}</span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {NATIVE_LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{lang.flag}</span>
                    <span>{lang.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline"
            onClick={() => setIsShareAllModalOpen(true)}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share all sets
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create New Set
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          Loading flashcard sets...
        </div>
      )}

      {!isLoading && sets.length === 0 && (
        <div className="text-center py-12 bg-muted/50 rounded-lg">
          <div className="text-lg font-medium mb-2">No flashcard sets yet</div>
          <p className="text-muted-foreground mb-4">
            Create your first flashcard set to help {studentName || 'Student'} learn vocabulary
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Set
          </Button>
        </div>
      )}

      {!isLoading && sets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sets.map((set) => (
            <FlashcardSetCard
              key={set.id}
              set={set}
              onEdit={() => handleOpenEditor(set.id)}
              onDelete={() => handleDeleteClick(set)}
              onShare={() => generateShareToken(set.id)}
              onAddCard={() => setAddCardForSetId(set.id)}
              teacherCalendarToken={teacherCalendarToken}
            />
          ))}
        </div>
      )}

      <CreateFlashcardSetModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        studentId={studentId}
        studentName={studentName}
        onCreate={createSet}
      />

      <DeleteFlashcardSetModal
        open={!!deleteSetId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteSetId(null);
            setDeleteSetTitle('');
          }
        }}
        setTitle={deleteSetTitle}
        onConfirmDelete={handleConfirmDelete}
      />

      {addCardSet && (
        <AddFlashcardModal
          open={!!addCardForSetId}
          onOpenChange={(open) => {
            if (!open) setAddCardForSetId(null);
          }}
          setId={addCardForSetId!}
          onAdd={addCard}
          studentNativeLanguage={currentLanguage || studentNativeLanguage}
          backType={addCardSet.back_type as 'translation' | 'definition'}
        />
      )}

      <ShareAllFlashcardSetsModal
        open={isShareAllModalOpen}
        onOpenChange={setIsShareAllModalOpen}
        studentEmail={student?.student_email}
        studentName={studentName}
        teacherName={profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : ''}
        teacherCalendarToken={teacherCalendarToken}
      />
    </div>
  );
}
