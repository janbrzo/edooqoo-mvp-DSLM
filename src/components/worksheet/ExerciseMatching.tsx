
import React, { useRef } from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";

interface ExerciseMatchingProps extends Partial<InteractiveExerciseProps> {
  items: any[];
  isEditing: boolean;
  viewMode: "student" | "teacher";
  getMatchedItems: (items: any[]) => any[];
  onItemChange: (iIndex: number, field: string, value: string) => void;
  worksheetId?: string; // PROBLEM 8: Optional worksheetId for deterministic shuffle
  // PROBLEM 1: Live Session answer prop for displaying student answers in blue
  liveSessionAnswer?: Record<number, any>;
  // A3: Disable inputs after homework submission
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

const ExerciseMatching: React.FC<ExerciseMatchingProps> = ({
  items, 
  isEditing, 
  viewMode, 
  getMatchedItems, 
  onItemChange,
  worksheetId,
  // Interactive props
  isInteractive = false,
  studentAnswers = {},
  onAnswerChange,
  showCorrectAnswers = false,
  // PROBLEM 1: Live Session
  liveSessionAnswer,
  // A3: Disable inputs
  disabled = false,
  // NanoSkill props
  onNanoSkillChange,
  isSharedWorksheet = false
}) => {
  // PROBLEM 8 FIX: Use useRef to ensure shuffle happens only once
  // Create a stable seed from item terms for deterministic order
  const itemsKey = items.map(item => item.term).join('|');
  const shuffledRef = useRef<any[] | null>(null);
  
  // Only shuffle once on first render or when items structurally change
  if (!shuffledRef.current || shuffledRef.current.length !== items.length) {
    const seed = itemsKey;
    shuffledRef.current = shuffleArrayWithSeed([...items], seed);
  }
  
  const shuffledDefinitions = shuffledRef.current;

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 vocabulary-matching-container">
      <div className="md:col-span-6 space-y-2 flex flex-col matching-terms-column">
        <h4 className="font-semibold bg-worksheet-purpleLight p-2 rounded-md">Terms</h4>
        {items.map((item, iIndex) => {
          const selectedAnswer = studentAnswers[iIndex];
          const correctLetter = String.fromCharCode(65 + shuffledDefinitions.findIndex(i => i.term === item.term));
          const isCorrect = showCorrectAnswers && selectedAnswer === correctLetter;
          const isIncorrect = showCorrectAnswers && selectedAnswer && !isCorrect;
          const isEmpty = showCorrectAnswers && !selectedAnswer;
          const liveAnswer = liveSessionAnswer?.[iIndex];
          const nanoSkill = safeGetNanoSkill(item);
          const showNanoSkill = viewMode === 'teacher' && nanoSkill;

          return (
            <div key={iIndex} className={`p-2 border rounded-md bg-white min-h-[52px] flex items-center
              ${isCorrect ? 'bg-green-200 border-2 border-green-600' : ''} 
              ${isIncorrect ? 'bg-red-200 border-2 border-red-600' : ''}
              ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
            `}>
              <div className="flex items-center gap-2 flex-wrap w-full">
                <span className="text-worksheet-purple font-medium">{iIndex + 1}.</span>
                
                {isInteractive ? (
                  <Select 
                    value={selectedAnswer || ""} 
                    onValueChange={(value) => onAnswerChange?.(iIndex, value)}
                    disabled={disabled}
                  >
                    <SelectTrigger className={`w-14 h-8 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
                      <SelectValue placeholder="?" />
                    </SelectTrigger>
                    <SelectContent>
                      {shuffledDefinitions.map((_, idx) => (
                        <SelectItem key={idx} value={String.fromCharCode(65 + idx)}>
                          {String.fromCharCode(65 + idx)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : viewMode === 'teacher' ? (
                  <span className="teacher-answer font-bold text-green-600">{correctLetter}</span>
                ) : (
                  <span className="student-answer-blank">___</span>
                )}

                <span className="flex-1">
                  {isEditing ? (
                    <input
                      type="text"
                      value={item.term}
                      onChange={e => onItemChange(iIndex, 'term', e.target.value)}
                      className="border p-1 editable-content w-full"
                    />
                  ) : item.term}
                </span>

                {showCorrectAnswers && (
                  <span className={`text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {isCorrect ? `✓ (${correctLetter})` : `✗ (${correctLetter})`}
                  </span>
                )}
                
                {/* PROBLEM 1: Display live session answer in blue */}
                {liveAnswer && !isInteractive && (
                  <span className="text-blue-600 font-medium text-sm">
                    [Student: {liveAnswer}]
                  </span>
                )}
                {/* NanoSkill Badge */}
                {showNanoSkill && (
                  <NanoSkillBadge
                    nanoSkill={nanoSkill}
                    allNanoSkills={safeGetAllNanoSkills(item)}
                    isEditing={isEditing}
                    onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(iIndex, ns, idx) : undefined}
                    className="ml-auto"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="md:col-span-6 space-y-2 flex flex-col matching-definitions-column">
        <h4 className="font-semibold bg-worksheet-purpleLight p-2 rounded-md">Definitions</h4>
        {shuffledDefinitions.map((item, iIndex) => (
          <div key={iIndex} className="p-2 border rounded-md bg-white min-h-[52px] flex items-center overflow-hidden">
            <span className="text-worksheet-purple font-medium mr-2">{String.fromCharCode(65 + iIndex)}.</span>
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
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExerciseMatching;
