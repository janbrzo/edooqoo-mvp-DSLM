import React from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { Input } from "@/components/ui/input";
import { safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { matchAnswer } from "@/lib/answers/matchAnswer";
import { AnswerStatusBadge, answerFieldClasses } from "./AnswerStatusBadge";

interface ExerciseNegativePrefixesProps extends Partial<InteractiveExerciseProps> {
  words: any[];
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onWordChange: (wIndex: number, field: string, value: string) => void;
  liveSessionAnswer?: Record<number, any>;
  // A3: Disable inputs after homework submission
  disabled?: boolean;
  // NanoSkill editing
  onNanoSkillChange?: (wIndex: number, nanoSkill: NanoSkill, skillIndex?: number) => void;
  isSharedWorksheet?: boolean;
}

const ExerciseNegativePrefixes: React.FC<ExerciseNegativePrefixesProps> = ({
  words = [], 
  isEditing, 
  viewMode, 
  onWordChange,
  liveSessionAnswer,
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
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {words.map((wordItem, wIndex) => {
          const studentAnswer = studentAnswers[wIndex] || '';
          const correctAnswer = wordItem?.answer || '';
          const match = matchAnswer(studentAnswer, correctAnswer, { mode: 'word' });
          const isCorrect = showCorrectAnswers && match.verdict === 'correct';
          const isReview = showCorrectAnswers && match.verdict === 'review';
          const isIncorrect = showCorrectAnswers && match.verdict === 'wrong';
          const isEmpty = showCorrectAnswers && !studentAnswer;
          const nanoSkill = safeGetNanoSkill(wordItem);
          const showNanoSkill = viewMode === 'teacher' && nanoSkill;

          return (
            <div key={wIndex} className="border rounded-lg p-3 bg-white">
              <div className="flex flex-col gap-2">
                <div className="flex-grow">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="leading-snug flex-grow">
                      {wIndex + 1}. {isEditing ? (
                        <input
                          type="text"
                          value={wordItem?.word || ''}
                          onChange={e => onWordChange(wIndex, 'word', e.target.value)}
                          className="border p-1 editable-content"
                        />
                      ) : (
                        wordItem?.word || 'Missing word'
                      )} →{' '}
                      {isInteractive ? (
                        <>
                          <Input
                            type="text"
                            value={studentAnswer}
                            onChange={(e) => onAnswerChange?.(wIndex, e.target.value)}
                            placeholder="negative form..."
                            className={`inline-block w-40 mx-1 h-7
                              ${isCorrect ? answerFieldClasses('correct') : ''}
                              ${isReview ? answerFieldClasses('review') : ''}
                              ${isIncorrect ? answerFieldClasses('wrong') : ''}
                              ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
                              ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                            `}
                            disabled={disabled}
                          />
                          {showCorrectAnswers && studentAnswer && (
                            <AnswerStatusBadge
                              verdict={match.verdict}
                              compact={match.verdict === 'correct'}
                              expected={isCorrect ? undefined : correctAnswer}
                            />
                          )}
                        </>
                      ) : '______'}
                    </p>
                    {/* NanoSkill Badge */}
                    {showNanoSkill && (
                      <NanoSkillBadge
                        nanoSkill={nanoSkill}
                        allNanoSkills={safeGetAllNanoSkills(wordItem)}
                        isEditing={isEditing}
                        onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(wIndex, ns, idx) : undefined}
                      />
                    )}
                  </div>
                </div>
                {(viewMode === 'teacher' || showCorrectAnswers) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-green-600 italic text-sm">
                      {isEditing ? (
                        <input
                          type="text"
                          value={wordItem?.answer || ''}
                          onChange={e => onWordChange(wIndex, 'answer', e.target.value)}
                          className="border p-1 editable-content w-full"
                        />
                      ) : (
                        <span>({correctAnswer})</span>
                      )}
                    </div>
                    {/* Live Session: show student answer in blue */}
                    {liveSessionAnswer?.[wIndex] !== undefined && (
                      <span className="text-blue-600 font-medium text-sm">
                        [Student: {liveSessionAnswer[wIndex]}]
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExerciseNegativePrefixes;
