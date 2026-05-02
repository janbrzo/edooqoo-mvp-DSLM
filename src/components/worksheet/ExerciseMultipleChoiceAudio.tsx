import React, { useMemo } from 'react';
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { safeGetText, safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";

interface Option {
  label: string;
  text: string;
  correct: boolean;
}

interface Question {
  text: string;
  options: Option[];
  nano_skill?: NanoSkill;
}

interface ExerciseMultipleChoiceAudioProps extends Partial<InteractiveExerciseProps> {
  questions?: Question[];
  audio_url?: string;
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onQuestionChange: (qIndex: number, field: string, value: any) => void;
  // PROBLEM 1: Live Session answer prop for displaying student answers in blue
  liveSessionAnswer?: Record<number, any>;
  disabled?: boolean;
  onNanoSkillChange?: (qIndex: number, newSkill: NanoSkill, skillIndex?: number) => void;
  // PROBLEM 4: Worksheet ID for deterministic shuffle
  worksheetId?: string;
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

const ExerciseMultipleChoiceAudio: React.FC<ExerciseMultipleChoiceAudioProps> = ({
  questions = [],
  audio_url,
  isEditing,
  viewMode,
  onQuestionChange,
  // Interactive props
  isInteractive = false,
  studentAnswers = {},
  onAnswerChange,
  showCorrectAnswers = false,
  // PROBLEM 1: Live Session
  liveSessionAnswer,
  disabled = false,
  onNanoSkillChange,
  // PROBLEM 4: Worksheet ID
  worksheetId
}) => {
  // PROBLEM 4: Shuffle options deterministically (only when not editing)
  const questionsWithShuffledOptions = useMemo(() => {
    if (isEditing) return questions;
    
    return questions.map((question, qIndex) => {
      if (!question.options || question.options.length === 0) return question;
      
      // Create seed from worksheetId and question content for consistency
      const seed = `mca-${qIndex}-${question.options.map((o: any) => o.text).join('|')}`;
      const shuffledOptions = shuffleArrayWithSeed([...question.options], seed);
      
      // Reassign labels A, B, C, D after shuffle
      const relabeled = shuffledOptions.map((opt: any, idx: number) => ({
        ...opt,
        label: String.fromCharCode(65 + idx) // A, B, C, D...
      }));
      
      return { ...question, options: relabeled };
    });
  }, [questions, isEditing]);

  return (
    <div>
      {!audio_url && (
        <div className="text-center text-sm text-muted-foreground py-2 bg-blue-50 border border-blue-200 rounded-lg mb-4">
          🎧 Listen to the audio in the Lesson Media section above before answering
        </div>
      )}
      
      <div className="space-y-2">
        {questionsWithShuffledOptions.map((question, qIndex) => {
          // CRITICAL FIX: Use safeGetText to prevent "Cannot read properties of undefined (reading 'replace')"
          const questionText = safeGetText(question?.text ?? question);
          const nanoSkill = safeGetNanoSkill(question);
          
          return (
          <div key={qIndex} className="border-b pb-2 multiple-choice-question">
            <div className="flex items-start gap-2 mb-1">
              <p className="font-medium leading-snug flex-1">
                {isEditing ? (
                  <input
                    type="text"
                    value={questionText}
                    onChange={e => onQuestionChange(qIndex, 'text', e.target.value)}
                    className="w-full border p-1 editable-content"
                  />
                ) : (
                  <>{qIndex + 1}. {questionText}</>
                )}
              </p>
              {/* NanoSkill Badge - show in teacher mode */}
              {viewMode === 'teacher' && nanoSkill && (
                <NanoSkillBadge
                  nanoSkill={nanoSkill}
                  allNanoSkills={safeGetAllNanoSkills(question)}
                  isEditing={isEditing}
                  onEdit={onNanoSkillChange ? (newSkill, idx) => onNanoSkillChange(qIndex, newSkill, idx) : undefined}
                />
              )}
            </div>
            {isInteractive ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {question.options?.map((option: any, oIndex: number) => {
                  const isSelected = studentAnswers[qIndex] === option.text;
                  const isCorrect = option.correct;
                  const showAsCorrect = showCorrectAnswers && isCorrect;
                  const showAsIncorrect = showCorrectAnswers && isSelected && !isCorrect;

                  return (
                    <div
                      key={oIndex}
                      onClick={() => !disabled && onAnswerChange?.(qIndex, option.text)}
                      className={`
                        p-2 border rounded-md flex items-center gap-2 multiple-choice-option
                        ${!disabled ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60 cursor-not-allowed'}
                        ${isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white'}
                        ${showAsCorrect ? 'bg-green-50 border-green-200' : ''}
                        ${showAsIncorrect ? 'bg-red-50 border-red-200' : ''}
                      `}
                    >
                      <div
                        className={`
                          w-5 h-5 rounded-full border flex items-center justify-center option-icon
                          ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}
                          ${showAsCorrect ? 'bg-green-500 border-green-500 text-white' : ''}
                          ${showAsIncorrect ? 'bg-red-500 border-red-500 text-white' : ''}
                        `}
                      >
                        {(isSelected || showAsCorrect) && <span className="text-white text-xs">✓</span>}
                        {showAsIncorrect && <span className="text-white text-xs">✗</span>}
                      </div>
                      <span>
                        {option.label}. {option.text}
                        {showCorrectAnswers && isSelected && isCorrect && (
                          <span className="ml-2 text-green-600 font-medium text-xs">(Your answer - Correct!)</span>
                        )}
                        {showCorrectAnswers && isSelected && !isCorrect && (
                          <span className="ml-2 text-red-600 font-medium text-xs">(Your answer)</span>
                        )}
                        {showCorrectAnswers && !isSelected && isCorrect && (
                          <span className="ml-2 text-green-600 font-medium text-xs">(Correct)</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {question.options?.map((option: any, oIndex: number) => {
                  // PROBLEM 1: Check if this option is selected by student in Live Session
                  // Fix: Compare with option.text (not oIndex) to match how answers are stored
                  const isLiveSelected = liveSessionAnswer?.[qIndex] === option.text;
                  
                  return (
                    <div
                      key={oIndex}
                      className={`
                        p-2 border rounded-md flex items-center gap-2 multiple-choice-option
                        ${viewMode === 'teacher' && option.correct ? 'bg-green-50 border-green-200' : 'bg-white'}
                        ${isLiveSelected ? 'ring-2 ring-blue-400 border-blue-400' : ''}
                      `}
                    >
                      <div
                        className={`
                          w-5 h-5 rounded-full border flex items-center justify-center option-icon
                          ${viewMode === 'teacher' && option.correct ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300'}
                          ${isLiveSelected ? 'bg-blue-500 border-blue-500 text-white' : ''}
                        `}
                      >
                        {viewMode === 'teacher' && option.correct && <span>✓</span>}
                        {isLiveSelected && !option.correct && <span>●</span>}
                      </div>
                      <span>
                        {isEditing ? (
                          <input
                            type="text"
                            value={option.text}
                            onChange={e => {
                              const newOptions = [...question.options];
                              newOptions[oIndex] = { ...option, text: e.target.value };
                              onQuestionChange(qIndex, 'options', newOptions);
                            }}
                            className="border p-1 editable-content ml-1"
                          />
                        ) : (
                          <>{option.label}. {option.text}</>
                        )}
                        {/* PROBLEM 1: Show blue indicator for live session answer */}
                        {isLiveSelected && (
                          <span className="ml-2 text-blue-600 font-medium text-xs">(Student)</span>
                        )}
                      </span>
                      {isEditing && (
                        <input
                          type="checkbox"
                          checked={option.correct}
                          onChange={e => {
                            const newOptions = [...question.options];
                            newOptions[oIndex] = { ...option, correct: e.target.checked };
                            onQuestionChange(qIndex, 'options', newOptions);
                          }}
                          className="ml-auto"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExerciseMultipleChoiceAudio;
