import React from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { Input } from "@/components/ui/input";
import { answersMatch } from "@/utils/textNormalization";
import { safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { matchAnswer } from "@/lib/answers/matchAnswer";
import { AnswerStatusBadge, answerFieldClasses } from "./AnswerStatusBadge";

interface ExerciseWordOrderProps extends Partial<InteractiveExerciseProps> {
  sentences: any[];
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onSentenceChange: (sIndex: number, field: string, value: string) => void;
  liveSessionAnswer?: Record<number, any>;
  disabled?: boolean;
  // NanoSkill editing
  onNanoSkillChange?: (sIndex: number, nanoSkill: NanoSkill, skillIndex?: number) => void;
  isSharedWorksheet?: boolean;
}

const ExerciseWordOrder: React.FC<ExerciseWordOrderProps> = ({
  sentences = [], 
  isEditing, 
  viewMode, 
  onSentenceChange,
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
  const handleScrambledWordsChange = (sIndex: number, value: string) => {
    onSentenceChange(sIndex, 'scrambled_words', value);
  };

  return (
    <div>
      <div className="space-y-3">
        {sentences.map((sentence, sIndex) => {
          const studentAnswer = studentAnswers[sIndex] || '';
          const correctAnswer = sentence?.correct_order || '';
          // Use normalized comparison to ignore punctuation and case
          const match = matchAnswer(studentAnswer, correctAnswer, { mode: 'sentence' });
          const isCorrect = showCorrectAnswers && match.verdict === 'correct';
          const isReview = showCorrectAnswers && match.verdict === 'review';
          const isIncorrect = showCorrectAnswers && match.verdict === 'wrong';
          const isEmpty = showCorrectAnswers && !studentAnswer;
          const nanoSkill = safeGetNanoSkill(sentence);
          const showNanoSkill = viewMode === 'teacher' && nanoSkill;

          return (
            <div key={sIndex} className="border rounded-lg p-3 bg-white">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium">{sIndex + 1}.</span>
                  
                  {isEditing ? (
                    <input
                      type="text"
                      value={sentence?.scrambled_words || ''}
                      onChange={e => handleScrambledWordsChange(sIndex, e.target.value)}
                      className="border p-1 editable-content flex-grow"
                      placeholder="word1 / word2 / word3"
                    />
                  ) : (
                    <div className="flex flex-wrap gap-2 flex-grow">
                      {(sentence?.scrambled_words || '').split(' / ').map((word: string, wIndex: number) => (
                        word.trim() && (
                          <span key={wIndex} className="bg-blue-100 px-2 py-1 rounded-md text-sm border">
                            {word.trim()}
                          </span>
                        )
                      ))}
                    </div>
                  )}
                  {/* NanoSkill Badge */}
                  {showNanoSkill && (
                    <NanoSkillBadge
                      nanoSkill={nanoSkill}
                      allNanoSkills={safeGetAllNanoSkills(sentence)}
                      isEditing={isEditing}
                      onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(sIndex, ns, idx) : undefined}
                    />
                  )}
                </div>

                {isInteractive && (
                  <Input
                    type="text"
                    value={studentAnswer}
                    onChange={(e) => onAnswerChange?.(sIndex, e.target.value)}
                    placeholder="Write the sentence in correct order..."
                    disabled={disabled}
                    className={`h-10
                      ${isCorrect ? answerFieldClasses('correct') : ''}
                      ${isReview ? answerFieldClasses('review') : ''}
                      ${isIncorrect ? answerFieldClasses('wrong') : ''}
                      ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
                      ${disabled ? 'bg-muted cursor-not-allowed opacity-70' : ''}
                    `}
                  />
                )}
                
                {isInteractive && showCorrectAnswers && (
                  <AnswerStatusBadge
                    verdict={match.verdict}
                    compact={match.verdict === 'correct'}
                    expected={isCorrect ? undefined : correctAnswer}
                  />
                )}
                
                {viewMode === 'teacher' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-green-600 italic text-sm">
                      {isEditing ? (
                        <input
                          type="text"
                          value={sentence?.correct_order || ''}
                          onChange={e => onSentenceChange(sIndex, 'correct_order', e.target.value)}
                          className="border p-1 editable-content w-full"
                        />
                      ) : (
                        <span>({sentence?.correct_order || 'Missing answer'})</span>
                      )}
                    </div>
                    {/* Live Session: show student answer in blue */}
                    {liveSessionAnswer?.[sIndex] !== undefined && (
                      <span className="text-blue-600 font-medium text-sm">
                        [Student: {liveSessionAnswer[sIndex]}]
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

export default ExerciseWordOrder;
