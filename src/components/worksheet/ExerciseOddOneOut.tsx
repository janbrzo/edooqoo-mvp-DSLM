import React, { useRef, useMemo } from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";

interface ExerciseOddOneOutProps extends Partial<InteractiveExerciseProps> {
  questions: any[];
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onQuestionChange: (qIndex: number, field: string, value: any) => void;
  liveSessionAnswer?: Record<number, any>;
  worksheetId?: string; // PROBLEM 3: For deterministic shuffle
  // A3: Disable inputs after homework submission
  disabled?: boolean;
  // NanoSkill editing
  onNanoSkillChange?: (qIndex: number, nanoSkill: NanoSkill, skillIndex?: number) => void;
  isSharedWorksheet?: boolean;
}

// PROBLEM 3 FIX: Seeded random for deterministic shuffle (same as ExerciseMatchingHalves)
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

function shuffleArrayWithSeed<T>(array: T[], seed: string): T[] {
  const newArray = [...array];
  const random = seededRandom(seed);
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const ExerciseOddOneOut: React.FC<ExerciseOddOneOutProps> = ({
  questions = [], 
  isEditing, 
  viewMode, 
  onQuestionChange,
  liveSessionAnswer,
  worksheetId,
  // Interactive props
  isInteractive = false,
  studentAnswers = {},
  onAnswerChange,
  showCorrectAnswers = false,
  // A3: Disable inputs
  disabled = false,
  // NanoSkill props
  onNanoSkillChange,
  isSharedWorksheet = false
}) => {
  // PROBLEM 3 FIX: Create a stable key based on questions content for deterministic shuffle
  const questionsKey = useMemo(() => 
    questions.map(q => (q.options || []).join('|')).join('||'),
    [questions]
  );
  
  // PROBLEM 3 FIX: Use useMemo with seeded random - shuffle is DETERMINISTIC based on content
  const questionsWithShuffledOptions = useMemo(() => {
    if (isEditing) return questions;
    
    return questions.map((question, qIndex) => {
      if (!question.options || question.options.length === 0) return question;
      
      // Create seed from worksheetId + question index + options content
      const seed = `${worksheetId || 'default'}-oddoneout-${qIndex}-${question.options.join('|')}`;
      const shuffled = shuffleArrayWithSeed([...question.options], seed);
      
      return {
        ...question,
        options: shuffled
      };
    });
  }, [questions, isEditing, worksheetId, questionsKey]);

  const handleOptionChange = (qIndex: number, oIndex: number, value: string) => {
    const question = questions[qIndex];
    if (!question) return;
    const newOptions = [...(question.options || [])];
    newOptions[oIndex] = value;
    onQuestionChange(qIndex, 'options', newOptions);
  };

  const handleCorrectAnswerChange = (qIndex: number, value: string) => {
    onQuestionChange(qIndex, 'correct_answer', value);
  };

  if (!questions || questions.length === 0) {
    return <div className="text-gray-500 italic">No questions available for this exercise.</div>;
  }

  return (
    <div>
      <div className="space-y-3">
        {questionsWithShuffledOptions.map((question, qIndex) => {
          const selectedAnswer = studentAnswers[qIndex];
          const correctAnswer = question?.correct_answer;
          const hasAnswered = selectedAnswer !== undefined;
          const isEmpty = showCorrectAnswers && !hasAnswered;
          const nanoSkill = safeGetNanoSkill(question);
          const showNanoSkill = viewMode === 'teacher' && nanoSkill;

          return (
            <div key={qIndex} className="border-b pb-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-medium">{qIndex + 1}.</span>
                
                <div className="flex flex-wrap gap-2 flex-grow">
                  {(question?.options || []).map((option: string, oIndex: number) => {
                    const isSelected = isInteractive && selectedAnswer === option;
                    const showAsCorrect = showCorrectAnswers && option === correctAnswer;
                    const showAsIncorrect = showCorrectAnswers && isSelected && option !== correctAnswer;

                    return (
                      <div 
                        key={oIndex} 
                        onClick={() => isInteractive && !disabled && onAnswerChange?.(qIndex, option)}
                        className={`
                          border rounded px-3 py-1 text-center
                          ${isInteractive && !disabled ? 'cursor-pointer hover:bg-gray-100' : 'bg-gray-50'}
                          ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                          ${isSelected && !showCorrectAnswers ? 'bg-blue-100 border-blue-500' : ''}
                          ${showAsCorrect ? 'bg-green-200 border-2 border-green-600' : ''}
                          ${showAsIncorrect ? 'bg-red-200 border-2 border-red-600' : ''}
                          ${isEmpty ? 'border-red-400' : ''}
                        `}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={option || ''}
                            onChange={e => handleOptionChange(qIndex, oIndex, e.target.value)}
                            className="w-16 border-0 bg-transparent text-center editable-content"
                          />
                        ) : (
                          <span>{option || 'Option'}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {(viewMode === 'teacher' || showCorrectAnswers) && (
                  <div className="flex items-center gap-2">
                    <div className="text-green-600 italic text-sm">
                      {isEditing ? (
                        <input
                          type="text"
                          value={correctAnswer || ''}
                          onChange={e => handleCorrectAnswerChange(qIndex, e.target.value)}
                          className="border p-1 editable-content w-20"
                        />
                      ) : (
                        <span>({correctAnswer || 'No answer'})</span>
                      )}
                    </div>
                    {/* Live Session: show student answer in blue */}
                    {liveSessionAnswer?.[qIndex] !== undefined && (
                      <span className="text-blue-600 font-medium text-sm">
                        [Student: {liveSessionAnswer[qIndex]}]
                      </span>
                    )}
                  </div>
                )}
                {/* NanoSkill Badge */}
                {showNanoSkill && (
                  <NanoSkillBadge
                    nanoSkill={nanoSkill}
                    allNanoSkills={safeGetAllNanoSkills(question)}
                    isEditing={isEditing}
                    onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(qIndex, ns, idx) : undefined}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExerciseOddOneOut;
