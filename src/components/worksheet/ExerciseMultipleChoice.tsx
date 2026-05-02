
import React, { useMemo } from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { safeGetText, safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";

interface ExerciseMultipleChoiceProps extends Partial<InteractiveExerciseProps> {
  questions: any[];
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onQuestionTextChange: (qIndex: number, value: string) => void;
  onOptionTextChange: (qIndex: number, oIndex: number, value: string) => void;
  // PROBLEM 1: Live Session answer prop for displaying student answers in blue
  liveSessionAnswer?: Record<number, any>;
  // A3: Disable inputs after homework submission
  disabled?: boolean;
  // NanoSkill editing
  onNanoSkillChange?: (qIndex: number, nanoSkill: NanoSkill, skillIndex?: number) => void;
  // Hide nano skills on shared worksheets
  isSharedWorksheet?: boolean;
  // PROBLEM 4: Worksheet ID for deterministic shuffle
  worksheetId?: string;
  // Exercise variant for media hints
  exerciseVariant?: 'audio' | 'picture' | 'plain';
}

// PROBLEM 4: Seeded random for deterministic shuffle
const seededRandom = (seed: string): (() => number) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return () => {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };
};

const shuffleArrayWithSeed = <T,>(array: T[], seed: string): T[] => {
  const random = seededRandom(seed);
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const ExerciseMultipleChoice: React.FC<ExerciseMultipleChoiceProps> = ({
  questions, 
  isEditing, 
  viewMode, 
  onQuestionTextChange, 
  onOptionTextChange,
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
  isSharedWorksheet = false,
  // PROBLEM 4: Worksheet ID for shuffle
  worksheetId,
  // Exercise variant
  exerciseVariant = 'plain'
}) => {
  // PROBLEM 4: Shuffle options deterministically (only when not editing)
  const questionsWithShuffledOptions = useMemo(() => {
    if (isEditing) return questions;
    
    return questions.map((question, qIndex) => {
      if (!question.options || question.options.length === 0) return question;
      
      // Create seed from worksheetId and question content for consistency
      const seed = `mc-${qIndex}-${question.options.map((o: any) => o.text).join('|')}`;
      const shuffledOptions = shuffleArrayWithSeed([...question.options], seed);
      
      // Reassign labels A, B, C, D after shuffle
      const relabeled = shuffledOptions.map((opt: any, idx: number) => ({
        ...opt,
        label: String.fromCharCode(65 + idx) // A, B, C, D...
      }));
      
      return { ...question, options: relabeled };
    });
  }, [questions, isEditing]);
  
  const handleOptionSelect = (qIndex: number, optionText: string) => {
    if (isInteractive && onAnswerChange && !disabled) {
      onAnswerChange(qIndex, optionText);
    }
  };

  return (
    <div className="space-y-2">
      {/* Picture hint for picture variant */}
      {exerciseVariant === 'picture' && (
        <div className="text-center text-sm text-muted-foreground py-2 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          🖼️ Look at the picture in the Lesson Media section above before answering
        </div>
      )}
      {questionsWithShuffledOptions.map((question, qIndex) => {
        // Safely extract text and nano_skill
        const questionText = safeGetText(question.text || question);
        const nanoSkill = safeGetNanoSkill(question);
        const selectedAnswer = studentAnswers[qIndex];
        const liveAnswer = liveSessionAnswer?.[qIndex];
        const showNanoSkill = viewMode === 'teacher' && nanoSkill;
        
        return (
          <div key={qIndex} className="border-b pb-2 multiple-choice-question">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium leading-snug flex-grow">
                {isEditing ? (
                  <input
                    type="text"
                    value={typeof question.text === 'string' ? question.text : questionText}
                    onChange={e => onQuestionTextChange(qIndex, e.target.value)}
                    className="w-full border p-1 editable-content"
                  />
                ) : (
                  <>{qIndex + 1}. {questionText}</>
                )}
              </p>
              {/* NanoSkill Badge - only for teachers, not on shared worksheets */}
              {showNanoSkill && (
                <NanoSkillBadge
                  nanoSkill={nanoSkill}
                  allNanoSkills={safeGetAllNanoSkills(question)}
                  isEditing={isEditing}
                  onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(qIndex, ns, idx) : undefined}
                />
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {question.options?.map((option: any, oIndex: number) => {
                const isSelected = isInteractive && selectedAnswer === option.text;
                const isCorrect = option.correct;
                const showAsCorrect = showCorrectAnswers && isCorrect;
                const showAsIncorrect = showCorrectAnswers && isSelected && !isCorrect;
                // PROBLEM 1: Check if this option is selected by student in Live Session
                const isLiveSelected = liveAnswer === option.text;

                return (
                  <div
                    key={oIndex}
                    onClick={() => isInteractive && handleOptionSelect(qIndex, option.text)}
                    className={`
                      p-2 border rounded-md flex items-center gap-2 multiple-choice-option
                      ${isInteractive && !disabled ? 'cursor-pointer hover:bg-gray-50' : ''}
                      ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                      ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white'}
                      ${showAsCorrect ? 'bg-green-50 border-green-200' : ''}
                      ${showAsIncorrect ? 'bg-red-50 border-red-200' : ''}
                      ${viewMode === 'teacher' && !isInteractive && isCorrect ? 'bg-green-50 border-green-200' : ''}
                      ${isLiveSelected && !isInteractive ? 'ring-2 ring-blue-400 border-blue-400' : ''}
                    `}
                  >
                    <div
                      className={`
                        w-5 h-5 rounded-full border flex items-center justify-center option-icon
                        ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}
                        ${showAsCorrect ? 'bg-green-500 border-green-500 text-white' : ''}
                        ${showAsIncorrect ? 'bg-red-500 border-red-500 text-white' : ''}
                        ${viewMode === 'teacher' && !isInteractive && isCorrect ? 'bg-green-500 border-green-500 text-white' : ''}
                        ${isLiveSelected && !isInteractive ? 'bg-blue-500 border-blue-500 text-white' : ''}
                      `}
                    >
                      {(isSelected || showAsCorrect || (viewMode === 'teacher' && !isInteractive && isCorrect)) && <span className="text-white text-xs">✓</span>}
                      {showAsIncorrect && <span className="text-white text-xs">✗</span>}
                      {isLiveSelected && !isInteractive && !isSelected && <span className="text-white text-xs">●</span>}
                    </div>
                    <span className="flex items-center gap-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={option.text}
                          onChange={e => onOptionTextChange(qIndex, oIndex, e.target.value)}
                          className="border p-1 editable-content ml-1"
                        />
                      ) : (
                        <>{option.label}. {option.text}</>
                      )}
                      {/* Labels after submit for clarity */}
                      {showCorrectAnswers && isSelected && isCorrect && (
                        <span className="ml-2 text-green-600 font-medium text-xs">(Your answer - Correct!)</span>
                      )}
                      {showCorrectAnswers && isSelected && !isCorrect && (
                        <span className="ml-2 text-red-600 font-medium text-xs">(Your answer)</span>
                      )}
                      {showCorrectAnswers && !isSelected && isCorrect && (
                        <span className="ml-2 text-green-600 font-medium text-xs">(Correct)</span>
                      )}
                      {/* Live session indicator */}
                      {isLiveSelected && !isInteractive && (
                        <span className="ml-2 text-blue-600 font-medium text-xs">(Student)</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExerciseMultipleChoice;
