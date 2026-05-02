import React from 'react';
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { safeGetText, safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge from "./NanoSkillBadge";

interface Statement {
  text: string;
  isTrue: boolean;
  nano_skill?: any;
}

interface ExerciseTrueFalseAudioProps extends Partial<InteractiveExerciseProps> {
  statements?: Statement[];
  audio_url?: string;
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onStatementChange: (sIndex: number, field: string, value: any) => void;
  liveSessionAnswer?: Record<number, any>;
  disabled?: boolean;
  isSharedWorksheet?: boolean;
  onNanoSkillChange?: (sIndex: number, nanoSkill: any, skillIndex?: number) => void;
  exerciseVariant?: 'audio' | 'picture' | 'plain';
}

const ExerciseTrueFalseAudio: React.FC<ExerciseTrueFalseAudioProps> = ({
  statements = [],
  audio_url,
  isEditing,
  viewMode,
  onStatementChange,
  liveSessionAnswer,
  isInteractive = false,
  studentAnswers = {},
  onAnswerChange,
  showCorrectAnswers = false,
  disabled = false,
  isSharedWorksheet = false,
  onNanoSkillChange,
  exerciseVariant = 'audio'
}) => {
  return (
    <div className="space-y-4">
      {exerciseVariant === 'audio' && !audio_url && (
        <div className="text-center text-sm text-muted-foreground py-2 bg-blue-50 border border-blue-200 rounded-lg mb-4">
          🎧 Listen to the audio in the Lesson Media section above before answering
        </div>
      )}
      {exerciseVariant === 'picture' && (
        <div className="text-center text-sm text-muted-foreground py-2 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          🖼️ Look at the picture in the Lesson Media section above before answering
        </div>
      )}
      
      <div className="space-y-2">
        {statements.map((statement, sIndex) => {
          const rawStudentAnswer = studentAnswers[sIndex];
          const studentAnswer = rawStudentAnswer === true || rawStudentAnswer === 'true'
            ? true
            : rawStudentAnswer === false || rawStudentAnswer === 'false'
              ? false
              : undefined;
          const hasAnswer = studentAnswer !== undefined;
          const isCorrect = showCorrectAnswers && hasAnswer && studentAnswer === statement.isTrue;
          const isIncorrect = showCorrectAnswers && hasAnswer && studentAnswer !== statement.isTrue;
          const isEmpty = showCorrectAnswers && !hasAnswer;
          const statementText = safeGetText(statement?.text ?? statement);
          const nanoSkill = safeGetNanoSkill(statement);
          const showNanoSkill = viewMode === 'teacher' && nanoSkill;

          return (
            <div key={sIndex} className={`rounded-lg p-3 mb-1 ${
              isCorrect ? 'bg-green-100 border-2 border-green-500' :
              isIncorrect ? 'bg-red-100 border-2 border-red-500' :
              isEmpty ? 'bg-red-50 border-2 border-red-300' :
              'border-b pb-2'
            }`}>
              <div className="flex flex-row items-center gap-3 flex-wrap">
                <div className="flex-grow flex items-center gap-2 flex-wrap">
                  <p className="leading-snug">
                    {isEditing ? (
                      <input
                        type="text"
                        value={statementText}
                        onChange={e => onStatementChange(sIndex, 'text', e.target.value)}
                        className="w-full border p-1 editable-content"
                      />
                    ) : (
                      <>{sIndex + 1}. {statementText}</>
                    )}
                  </p>
                  {showNanoSkill && (
                    <NanoSkillBadge
                      nanoSkill={nanoSkill}
                      allNanoSkills={safeGetAllNanoSkills(statement)}
                      onEdit={onNanoSkillChange ? (newSkill, idx) => onNanoSkillChange(sIndex, newSkill, idx) : undefined}
                    />
                  )}
                </div>
                {isInteractive ? (
                  <div className="flex items-center gap-2 ml-auto shrink-0">
                    <RadioGroup
                      value={studentAnswer === true ? 'true' : studentAnswer === false ? 'false' : ''}
                      onValueChange={(value) => onAnswerChange?.(sIndex, value === 'true')}
                      className="flex gap-4"
                      disabled={disabled}
                    >
                      <div className={`flex items-center space-x-2 ${isCorrect && studentAnswer === true ? 'text-green-600' : isIncorrect && studentAnswer === true ? 'text-red-600' : ''} ${disabled ? 'opacity-70' : ''}`}>
                        <RadioGroupItem value="true" id={`true-${sIndex}`} disabled={disabled} />
                        <Label htmlFor={`true-${sIndex}`}>True</Label>
                      </div>
                      <div className={`flex items-center space-x-2 ${isCorrect && studentAnswer === false ? 'text-green-600' : isIncorrect && studentAnswer === false ? 'text-red-600' : ''} ${disabled ? 'opacity-70' : ''}`}>
                        <RadioGroupItem value="false" id={`false-${sIndex}`} disabled={disabled} />
                        <Label htmlFor={`false-${sIndex}`}>False</Label>
                      </div>
                    </RadioGroup>
                    {showCorrectAnswers && (
                      <span className={`text-sm font-semibold whitespace-nowrap ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                        {hasAnswer ? (isCorrect ? '✓' : `✗ Correct: ${statement.isTrue ? 'True' : 'False'}`) : `✗ Correct: ${statement.isTrue ? 'True' : 'False'}`}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="ml-4 flex items-center space-x-4">
                    {(() => {
                      const rawAnswer = liveSessionAnswer?.[sIndex];
                      const normalizedAnswer = rawAnswer === true || rawAnswer === 'true' 
                        ? true 
                        : rawAnswer === false || rawAnswer === 'false' 
                          ? false 
                          : null;
                      
                      return (
                        <div className="flex space-x-4">
                          <label className={`inline-flex items-center ${
                            normalizedAnswer === true ? 'bg-blue-100 px-2 py-1 rounded' : ''
                          }`}>
                            <input 
                              type="radio" 
                              name={`statement-audio-${sIndex}`} 
                              className="form-radio h-4 w-4" 
                              disabled={true}
                              checked={viewMode === 'teacher' && statement.isTrue === true}
                            />
                            <span className="ml-2">True</span>
                            {normalizedAnswer === true && (
                              <span className="ml-1 text-blue-600 font-medium text-xs">(Student)</span>
                            )}
                          </label>
                          <label className={`inline-flex items-center ${
                            normalizedAnswer === false ? 'bg-blue-100 px-2 py-1 rounded' : ''
                          }`}>
                            <input 
                              type="radio" 
                              name={`statement-audio-${sIndex}`} 
                              className="form-radio h-4 w-4"
                              disabled={true}
                              checked={viewMode === 'teacher' && statement.isTrue === false}
                            />
                            <span className="ml-2">False</span>
                            {normalizedAnswer === false && (
                              <span className="ml-1 text-blue-600 font-medium text-xs">(Student)</span>
                            )}
                          </label>
                        </div>
                      );
                    })()}
                    {viewMode === 'teacher' && (
                      <span className="text-green-600 italic text-sm">
                        {isEditing ? (
                          <select
                            value={statement.isTrue ? "true" : "false"}
                            onChange={e => onStatementChange(sIndex, 'isTrue', e.target.value === "true")}
                            className="border p-1 editable-content"
                          >
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        ) : (
                          <span>({statement.isTrue ? "True" : "False"})</span>
                        )}
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

export default ExerciseTrueFalseAudio;
