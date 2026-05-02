
import React, { useState } from "react";
import { FileText, Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickImportToFlashcardsModal } from "@/components/flashcards/QuickImportToFlashcardsModal";
import { LoginRequiredModal } from "@/components/LoginRequiredModal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuthFlow } from "@/hooks/useAuthFlow";

interface Worksheet {
  title: string;
  subtitle: string;
  introduction: string;
  exercises: any[];
  vocabulary_sheet: {
    term: string;
    meaning: string;
  }[];
}

interface VocabularySheetProps {
  vocabularySheet: { term: string; meaning: string }[];
  isEditing: boolean;
  viewMode: "student" | "teacher" | "live-session";
  editableWorksheet: Worksheet;
  setEditableWorksheet: (worksheet: Worksheet) => void;
  // Optional flashcard props
  studentId?: string;
  teacherId?: string;
  worksheetId?: string;
  nativeLanguage?: string;
}

const VocabularySheet = ({
  vocabularySheet,
  isEditing,
  viewMode,
  editableWorksheet,
  setEditableWorksheet,
  studentId,
  teacherId,
  worksheetId,
  nativeLanguage = 'Spanish'
}: VocabularySheetProps) => {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { isRegisteredUser } = useAuthFlow();
  
  // Show flashcard buttons when all required IDs are present
  const canAddFlashcards = studentId && teacherId && worksheetId && !isEditing;
  
  // Show locked flashcard button for anonymous users
  const showLockedFlashcardButton = !isRegisteredUser && !isEditing;

  const handleAddSingleWord = (index: number) => {
    if (!isRegisteredUser) {
      setShowLoginModal(true);
      return;
    }
    setSelectedWords([index]);
    setIsImportModalOpen(true);
  };

  const handleAddAllWords = () => {
    if (!isRegisteredUser) {
      setShowLoginModal(true);
      return;
    }
    setSelectedWords(vocabularySheet.map((_, idx) => idx));
    setIsImportModalOpen(true);
  };

  return (
    <>
      <div className="mb-6 bg-white border rounded-lg overflow-hidden shadow-sm" style={{ breakBefore: "page" }} id="vocabulary-sheet">
        <div className="bg-worksheet-purple text-white p-2 flex justify-between items-center exercise-header">
          <div className="flex items-center">
            <div className="p-2 bg-white/20 rounded-full mr-3">
              <FileText className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">Vocabulary Sheet</h3>
          </div>
          {/* Add All to Flashcards - visible for registered users with proper setup */}
          {canAddFlashcards && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddAllWords}
              className="bg-green-500 hover:bg-green-600 text-white border-0"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add All to Flashcards
            </Button>
          )}
          {/* Locked Add All to Flashcards - visible for anonymous users */}
          {showLockedFlashcardButton && !canAddFlashcards && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowLoginModal(true)}
                  className="opacity-50 cursor-not-allowed bg-gray-400 hover:bg-gray-400 text-white border-0"
                >
                  <Lock className="h-3 w-3 mr-1" />
                  <Plus className="h-4 w-4 mr-1" />
                  Add All to Flashcards
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>🔒 Login to add vocabulary to flashcards</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="p-5">
          <p className="font-medium mb-4">
            Learn and practice these key vocabulary terms related to the topic.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vocabularySheet.map((item, index) => (
              <div key={index} className="border rounded-md p-4 vocabulary-card relative">
                {canAddFlashcards && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAddSingleWord(index)}
                    className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-green-100"
                    title="Add to flashcards"
                  >
                    <Plus className="h-4 w-4 text-green-600" />
                  </Button>
                )}
                <p className="font-semibold text-worksheet-purple pr-8">
                  {isEditing ? (
                    <input
                      type="text"
                      value={item.term}
                      onChange={e => {
                        const updatedVocab = [...editableWorksheet.vocabulary_sheet];
                        updatedVocab[index] = {
                          ...updatedVocab[index],
                          term: e.target.value
                        };
                        setEditableWorksheet({
                          ...editableWorksheet,
                          vocabulary_sheet: updatedVocab
                        });
                      }}
                      className="w-full border p-1 editable-content"
                    />
                  ) : item.term}
                </p>
                {viewMode === 'teacher' ? (
                  <p className="text-sm text-gray-600 mt-2">
                    {isEditing ? (
                      <textarea
                        value={item.meaning}
                        onChange={e => {
                          const updatedVocab = [...editableWorksheet.vocabulary_sheet];
                          updatedVocab[index] = {
                            ...updatedVocab[index],
                            meaning: e.target.value
                          };
                          setEditableWorksheet({
                            ...editableWorksheet,
                            vocabulary_sheet: updatedVocab
                          });
                        }}
                        className="w-full border p-1 editable-content h-12"
                      />
                    ) : item.meaning}
                  </p>
                ) : (
                  <>
                    <span className="vocabulary-definition-label">Definition or translation:</span>
                    <span className="text-sm text-gray-500">_____________________</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {canAddFlashcards && (
        <QuickImportToFlashcardsModal
          open={isImportModalOpen}
          onOpenChange={setIsImportModalOpen}
          studentId={studentId}
          teacherId={teacherId}
          worksheetId={worksheetId}
          vocabularyItems={selectedWords.map(idx => ({
            word: vocabularySheet[idx].term,
            definition: vocabularySheet[idx].meaning,
            example: undefined
          }))}
          nativeLanguage={nativeLanguage}
        />
      )}

      {/* Login Required Modal for anonymous users */}
      <LoginRequiredModal
        open={showLoginModal}
        onOpenChange={setShowLoginModal}
        featureName="Add to Flashcards"
      />
    </>
  );
};

export default VocabularySheet;
