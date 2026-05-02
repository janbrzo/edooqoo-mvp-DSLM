import React from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { Input } from "@/components/ui/input";
import { safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { AiEvaluationBadge, AiEvaluation } from "@/components/homework/AiEvaluationBadge";

interface ExerciseSentenceTransformationProps extends Partial<InteractiveExerciseProps> {
  sentences: any[];
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onSentenceChange: (sIndex: number, field: string, value: string) => void;
  liveSessionAnswer?: Record<number, any>;
  disabled?: boolean;
  onNanoSkillChange?: (sIndex: number, nanoSkill: NanoSkill, skillIndex?: number) => void;
  isSharedWorksheet?: boolean;
  aiEvaluations?: Record<number, AiEvaluation>;
  liveSessionContext?: { worksheetId: string; exerciseIndex: number; exerciseType: string; teacherId: string; };
}

const ExerciseSentenceTransformation: React.FC<ExerciseSentenceTransformationProps> = ({
  sentences = [], isEditing, viewMode, onSentenceChange,
  liveSessionAnswer,
  isInteractive = false,
  studentAnswers = {},
  onAnswerChange,
  showCorrectAnswers = false,
  disabled = false,
  onNanoSkillChange,
  isSharedWorksheet = false,
  aiEvaluations,
  liveSessionContext
}) => {
  return (
    <div>
      <div className="space-y-3">
        {sentences.map((sentence, sIndex) => {
          const studentAnswer = studentAnswers[sIndex] || '';
          const correctAnswer = sentence?.transformed || '';
          const isCorrect = showCorrectAnswers && studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
          const isIncorrect = showCorrectAnswers && studentAnswer && !isCorrect;
          const isEmpty = showCorrectAnswers && !studentAnswer;
          const nanoSkill = safeGetNanoSkill(sentence);
          const showNanoSkill = viewMode === 'teacher' && nanoSkill;

          return (
            <div key={sIndex} className="border rounded-lg p-3 bg-white">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{sIndex + 1}.</span>
                  
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={sentence?.original || ''}
                        onChange={e => onSentenceChange(sIndex, 'original', e.target.value)}
                        className="flex-grow border p-1 editable-content"
                      />
                      <input
                        type="text"
                        value={sentence?.instruction || ''}
                        onChange={e => onSentenceChange(sIndex, 'instruction', e.target.value)}
                        className="w-48 border p-1 editable-content text-sm"
                      />
                    </>
                  ) : (
                    <>
                      <span className="flex-grow">{sentence?.original || 'Missing original sentence'}</span>
                      <span className="text-sm text-gray-600">({sentence?.instruction || 'Missing instruction'})</span>
                    </>
                  )}
                  {showNanoSkill && (
                    <NanoSkillBadge
                      nanoSkill={nanoSkill}
                      allNanoSkills={safeGetAllNanoSkills(sentence)}
                      isEditing={isEditing}
                      onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(sIndex, ns, idx) : undefined}
                    />
                  )}
                </div>

                {isInteractive ? (
                  <Input
                    type="text"
                    value={studentAnswer}
                    onChange={(e) => onAnswerChange?.(sIndex, e.target.value)}
                    placeholder="Transform the sentence..."
                    className={`h-10
                      ${isCorrect ? 'bg-green-200 border-2 border-green-600' : ''}
                      ${isIncorrect ? 'bg-red-200 border-2 border-red-600' : ''}
                      ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
                      ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
                    `}
                    disabled={disabled}
                  />
                ) : (
                  <span className="ml-6">→ ___________________________</span>
                )}
                
                {/* AI Evaluation feedback */}
                {aiEvaluations?.[sIndex] && (disabled || isSharedWorksheet) && (
                  <div className="ml-6">
                    <AiEvaluationBadge evaluation={aiEvaluations[sIndex]}
                      isLiveSession={!!liveSessionContext} worksheetId={liveSessionContext?.worksheetId}
                      exerciseIndex={liveSessionContext?.exerciseIndex} exerciseType={liveSessionContext?.exerciseType}
                      teacherId={liveSessionContext?.teacherId} />
                  </div>
                )}
                
                {(viewMode === 'teacher' || showCorrectAnswers) && (
                  <div className="flex items-center gap-2 flex-wrap ml-6">
                    <div className="text-green-600 italic text-sm">
                      {isEditing ? (
                        <input
                          type="text"
                          value={correctAnswer}
                          onChange={e => onSentenceChange(sIndex, 'transformed', e.target.value)}
                          className="border p-1 editable-content w-full"
                        />
                      ) : (
                        <span>({correctAnswer || 'Missing answer'})</span>
                      )}
                    </div>
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

export default ExerciseSentenceTransformation;
