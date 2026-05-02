import React from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { Input } from "@/components/ui/input";
import { safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";

interface ExerciseCompleteWordProps extends Partial<InteractiveExerciseProps> {
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

const ExerciseCompleteWord: React.FC<ExerciseCompleteWordProps> = ({
  words = [], isEditing, viewMode, onWordChange,
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
  if (!words || words.length === 0) {
    return <div className="text-gray-500 italic">No words available for this exercise.</div>;
  }

  return (
    <div>
      <p className="mb-3 font-medium">Complete the words using the definitions:</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {words.map((wordItem, wIndex) => {
          const studentAnswer = studentAnswers[wIndex] || '';
          const correctAnswer = wordItem?.complete || wordItem?.complete_word || '';
          const isCorrect = showCorrectAnswers && studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
          const isIncorrect = showCorrectAnswers && studentAnswer && !isCorrect;
          const isEmpty = showCorrectAnswers && !studentAnswer;
          const nanoSkill = safeGetNanoSkill(wordItem);
          const showNanoSkill = viewMode === 'teacher' && nanoSkill;

          return (
            <div key={wIndex} className="border rounded-lg p-3 bg-white">
              <div className="flex flex-col gap-2">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="leading-snug flex-grow">
                      <span className="font-medium">{wIndex + 1}. </span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={wordItem?.partial || wordItem?.incomplete_word || ''}
                          onChange={e => onWordChange(wIndex, 'partial', e.target.value)}
                          className="border p-1 editable-content font-mono"
                        />
                      ) : (
                        <span className="font-mono font-bold text-lg">{wordItem?.partial || wordItem?.incomplete_word || 'Missing word'}</span>
                      )}
                      <span className="ml-2">–</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={wordItem?.clue || wordItem?.definition || ''}
                          onChange={e => onWordChange(wIndex, 'clue', e.target.value)}
                          className="ml-2 border p-1 editable-content flex-grow"
                        />
                      ) : (
                        <span className="ml-2 text-gray-600">{wordItem?.clue || wordItem?.definition || 'Missing definition'}</span>
                      )}
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

                {isInteractive && (
                  <Input
                    type="text"
                    value={studentAnswer}
                    onChange={(e) => onAnswerChange?.(wIndex, e.target.value)}
                    placeholder="Complete the word..."
                    className={`h-10 
                      ${isCorrect ? 'bg-green-200 border-2 border-green-600' : ''}
                      ${isIncorrect ? 'bg-red-200 border-2 border-red-600' : ''}
                      ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
                      ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                    `}
                    disabled={disabled}
                  />
                )}
                
                {isInteractive && showCorrectAnswers && (
                  <span className={`text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {isCorrect ? '✓' : `✗ (${correctAnswer})`}
                  </span>
                )}
                
                {viewMode === 'teacher' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-green-600 italic text-sm">
                      {isEditing ? (
                        <input
                          type="text"
                          value={correctAnswer}
                          onChange={e => onWordChange(wIndex, 'complete', e.target.value)}
                          className="border p-1 editable-content w-full"
                        />
                      ) : (
                        <span>({correctAnswer || 'No answer'})</span>
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

export default ExerciseCompleteWord;
