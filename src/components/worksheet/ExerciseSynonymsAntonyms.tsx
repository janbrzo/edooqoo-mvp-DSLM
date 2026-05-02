import React, { useRef } from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";

interface ExerciseSynonymsAntonymsProps extends Partial<InteractiveExerciseProps> {
  items: any[];
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onItemChange: (iIndex: number, field: string, value: string) => void;
  exerciseType?: string;
  worksheetId?: string;
  liveSessionAnswer?: Record<number, any>;
  disabled?: boolean;
  // NanoSkill editing
  onNanoSkillChange?: (iIndex: number, nanoSkill: NanoSkill, skillIndex?: number) => void;
  isSharedWorksheet?: boolean;
}

// PROBLEM 8 FIX: Seeded random for deterministic shuffle
function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return function() {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return (hash % 1000) / 1000;
  };
}

function shuffleArrayWithSeed(array: any[], seed: string) {
  const newArray = [...array];
  const random = seededRandom(seed);
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const ExerciseSynonymsAntonyms: React.FC<ExerciseSynonymsAntonymsProps> = ({
  items,
  isEditing,
  viewMode,
  onItemChange,
  exerciseType = 'synonyms-antonyms',
  worksheetId,
  liveSessionAnswer,
  // Interactive props
  isInteractive = false,
  studentAnswers = {},
  onAnswerChange,
  showCorrectAnswers = false,
  disabled = false,
  // NanoSkill props
  onNanoSkillChange,
  isSharedWorksheet = false
}) => {
  // PROBLEM 3 FIX: Use ONLY itemsKey for seed - NOT worksheetId
  // This ensures consistent shuffle order between teacher panel and shared worksheet
  const itemsKey = items.map(item => item.term).join('|');
  const shuffledRef = useRef<any[] | null>(null);
  
  if (!shuffledRef.current || shuffledRef.current.length !== items.length) {
    // CRITICAL: Use only content-based seed for cross-view consistency
    const seed = `syn-${itemsKey}`;
    shuffledRef.current = shuffleArrayWithSeed([...items], seed);
  }
  
  const shuffledDefinitions = shuffledRef.current;

  // Determine the title based on exercise type
  const rightColumnTitle = exerciseType === 'synonyms' ? 'Synonyms' 
                          : exerciseType === 'antonyms' ? 'Antonyms'
                          : 'Synonyms/Antonyms';

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 vocabulary-matching-container">
      {/* Left column: Words with inline Select for interactive mode */}
      <div className="md:col-span-6 space-y-2 flex flex-col">
        <h4 className="font-semibold bg-worksheet-purpleLight p-2 rounded-md">Words</h4>
        {items.map((item, iIndex) => {
          const correctAnswer = String.fromCharCode(65 + shuffledDefinitions.findIndex(i => i.term === item.term));
          const liveAnswer = liveSessionAnswer?.[iIndex];
          const nanoSkill = safeGetNanoSkill(item);
          const showNanoSkill = viewMode === 'teacher' && nanoSkill;
          
          // Get student answer for inline display (like Matching Halves)
          const studentAnswer = studentAnswers[iIndex];
          const isCorrect = showCorrectAnswers && studentAnswer === correctAnswer;
          const isIncorrect = showCorrectAnswers && studentAnswer && studentAnswer !== correctAnswer;
          const isEmpty = showCorrectAnswers && !studentAnswer;
          
          return (
            <div key={iIndex} className={`p-2 border rounded-md bg-white min-h-[52px] flex items-center
              ${isCorrect ? 'bg-green-200 border-2 border-green-600' : ''}
              ${isIncorrect ? 'bg-red-200 border-2 border-red-600' : ''}
              ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
            `}>
              <div className="flex items-center gap-2 flex-wrap w-full">
                <span className="text-worksheet-purple font-medium">{iIndex + 1}.</span>
                
                {/* Inline Select dropdown for interactive mode (like Matching Halves) */}
                {isInteractive && (
                  <Select
                    value={studentAnswer || ''}
                    onValueChange={(value) => onAnswerChange?.(iIndex, value)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-14 h-8">
                      <SelectValue placeholder="?" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {shuffledDefinitions.map((_, idx) => (
                        <SelectItem key={idx} value={String.fromCharCode(65 + idx)}>
                          {String.fromCharCode(65 + idx)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {/* Show correct answer after submission */}
                {showCorrectAnswers && (
                  <span className={`text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {isCorrect ? `✓ (${correctAnswer})` : `✗ (${correctAnswer})`}
                  </span>
                )}
                
                {viewMode === 'teacher' && !isInteractive ? (
                  <>
                    <span className="teacher-answer">{correctAnswer}</span>
                    {/* Live Session: show student answer in blue */}
                    {liveAnswer !== undefined && (
                      <span className="text-blue-600 font-medium text-sm">
                        [Student: {liveAnswer}]
                      </span>
                    )}
                  </>
                ) : !isInteractive ? (
                  <span className="student-answer-blank"></span>
                ) : null}
                
                <span className="flex-grow">
                  {isEditing ? (
                    <input
                      type="text"
                      value={item.term}
                      onChange={e => onItemChange(iIndex, 'term', e.target.value)}
                      className="border p-1 editable-content w-full"
                    />
                  ) : item.term}
                </span>
                {/* NanoSkill Badge */}
                {showNanoSkill && (
                  <NanoSkillBadge
                    nanoSkill={nanoSkill}
                    allNanoSkills={safeGetAllNanoSkills(item)}
                    isEditing={isEditing}
                    onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(iIndex, ns, idx) : undefined}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right column: Definitions with A, B, C labels */}
      <div className="md:col-span-6 space-y-2 flex flex-col">
        <h4 className="font-semibold bg-worksheet-purpleLight p-2 rounded-md">{rightColumnTitle}</h4>
        
        {/* ALWAYS show the definitions column (A, B, C...) */}
        {shuffledDefinitions.map((item, iIndex) => (
          <div key={iIndex} className="p-2 border rounded-md bg-white min-h-[52px] flex items-center">
            <span className="text-worksheet-purple font-medium mr-2">{String.fromCharCode(65 + iIndex)}.</span>
            <span className="flex-grow">
              {isEditing ? (
                <input
                  type="text"
                  value={item.definition}
                  onChange={e => {
                    const originalIndex = items.findIndex(i => i.term === item.term);
                    if (originalIndex !== -1) {
                      onItemChange(originalIndex, 'definition', e.target.value);
                    }
                  }}
                  className="border p-1 editable-content w-full"
                />
              ) : item.definition}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExerciseSynonymsAntonyms;
