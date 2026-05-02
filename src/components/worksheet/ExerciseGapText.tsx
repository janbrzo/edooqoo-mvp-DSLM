import React from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { Input } from "@/components/ui/input";
import { safeGetText, safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";

interface ExerciseGapTextProps extends Partial<InteractiveExerciseProps> {
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

const ExerciseGapText: React.FC<ExerciseGapTextProps> = ({
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
  if (!sentences || sentences.length === 0) {
    return <div className="text-gray-500 italic">No sentences available for this exercise.</div>;
  }

  return (
    <div className="space-y-2">
      {sentences.map((sentence, sIndex) => {
        const sentenceText = safeGetText(sentence?.text || sentence);
        const nanoSkill = safeGetNanoSkill(sentence);
        const showNanoSkill = viewMode === 'teacher' && nanoSkill;
        
        // Count blanks to determine key strategy
        const parts = sentenceText.split(/_+/);
        const blanksCount = parts.length - 1;
        
        // For single blank: use sIndex key (backward compatible)
        // For multi blank: use `${sIndex}_${blankIndex}` keys
        const getBlankKey = (blankIndex: number): string | number => {
          return blanksCount === 1 ? sIndex : `${sIndex}_${blankIndex}`;
        };
        
        // Get correct answers array — handle "answer1 / answer2" format for multi-blank
        const correctAnswers: string[] = (() => {
          if (sentence?.answers && Array.isArray(sentence.answers) && sentence.answers.length > 0) {
            return sentence.answers;
          }
          const rawAnswer = sentence?.answer || '';
          // If multi-blank and answer contains " / ", split it
          if (blanksCount > 1 && rawAnswer.includes(' / ')) {
            return rawAnswer.split(/\s*\/\s*/);
          }
          return [rawAnswer];
        })();
        
        // Overall correctness for the sentence (all blanks correct)
        const allBlanksCorrect = blanksCount > 0 && Array.from({ length: blanksCount }).every((_, i) => {
          const key = getBlankKey(i);
          const answer = studentAnswers[key] || '';
          const correct = correctAnswers[i] || correctAnswers[0] || '';
          return answer.toLowerCase().trim() === correct.toLowerCase().trim();
        });

        return (
          <div key={sIndex} className="border rounded-lg p-3 bg-white">
            <div className="flex flex-col gap-2">
              <div className="flex-grow">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="leading-snug flex-grow">
                    {isEditing ? (
                      <input
                        type="text"
                        value={sentence?.text || ''}
                        onChange={e => onSentenceChange(sIndex, 'text', e.target.value)}
                        className="w-full border p-1 editable-content"
                      />
                    ) : isInteractive ? (
                      <span>
                        {sIndex + 1}. {parts.map((part: string, pIndex: number, arr: string[]) => {
                          if (pIndex >= arr.length - 1) {
                            // Last part — just text, plus overall feedback
                            return (
                              <React.Fragment key={pIndex}>
                                {part}
                                {showCorrectAnswers && (
                                  <span className={`ml-2 text-sm font-medium ${allBlanksCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                    {allBlanksCorrect ? '✓ Correct' : `✗ (${correctAnswers.join(', ')})`}
                                  </span>
                                )}
                              </React.Fragment>
                            );
                          }
                          
                          const blankKey = getBlankKey(pIndex);
                          const blankAnswer = studentAnswers[blankKey] || '';
                          const blankCorrectAnswer = correctAnswers[pIndex] || correctAnswers[0] || '';
                          const blankIsCorrect = showCorrectAnswers && blankAnswer.toLowerCase().trim() === blankCorrectAnswer.toLowerCase().trim();
                          const blankIsIncorrect = showCorrectAnswers && blankAnswer && !blankIsCorrect;
                          const blankIsEmpty = showCorrectAnswers && !blankAnswer;
                          
                          return (
                            <React.Fragment key={pIndex}>
                              {part}
                              <Input
                                value={blankAnswer}
                                onChange={(e) => onAnswerChange?.(blankKey as any, e.target.value)}
                                disabled={disabled}
                                className={`inline-block w-32 mx-1 h-7 
                                  ${blankIsCorrect ? 'bg-green-200 border-2 border-green-600' : ''}
                                  ${blankIsIncorrect ? 'bg-red-200 border-2 border-red-600' : ''}
                                  ${blankIsEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
                                  ${disabled ? 'bg-muted cursor-not-allowed opacity-70' : ''}
                                `}
                                placeholder="..."
                              />
                            </React.Fragment>
                          );
                        })}
                      </span>
                    ) : (
                      <>{sIndex + 1}. {sentenceText.replace(/_+/g, "_______________")}</>
                    )}
                  </p>
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
              </div>
              {viewMode === 'teacher' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-green-600 italic text-sm">
                    {isEditing ? (
                      <input
                        type="text"
                        value={sentence?.answer || ''}
                        onChange={e => onSentenceChange(sIndex, 'answer', e.target.value)}
                        className="border p-1 editable-content w-full"
                      />
                    ) : (
                      <span>({correctAnswers.join(', ')})</span>
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
  );
};

export default ExerciseGapText;
