import React from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { safeGetNanoSkill, safeGetText, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { AiEvaluationBadge, AiEvaluation } from "@/components/homework/AiEvaluationBadge";
import { HomeworkSpeakingRecorder } from "@/components/homework/HomeworkSpeakingRecorder";

interface ExerciseDialogueProps extends Partial<InteractiveExerciseProps> {
  dialogue: any[];
  expressions?: any[];
  expression_instruction?: string;
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onDialogueChange: (index: number, field: string, value: string) => void;
  onExpressionChange: (index: number, value: string) => void;
  onExpressionInstructionChange: (value: string) => void;
  // PROBLEM 1: Live Session answer prop for displaying student answers in blue
  liveSessionAnswer?: Record<number, any>;
  // A3: Disable inputs after homework submission
  disabled?: boolean;
  // NanoSkill editing
  onNanoSkillChange?: (eIndex: number, nanoSkill: NanoSkill, skillIndex?: number) => void;
  isSharedWorksheet?: boolean;
  // AI Evaluations per question
  aiEvaluations?: Record<number, AiEvaluation>;
  liveSessionContext?: { worksheetId: string; exerciseIndex: number; exerciseType: string; teacherId: string; };
  audioAnswers?: Record<number, string>;
  onAudioAnswerChange?: (questionIndex: number, audioUrl: string) => void;
}

const ExerciseDialogue: React.FC<ExerciseDialogueProps> = ({
  dialogue,
  expressions,
  expression_instruction,
  isEditing,
  viewMode,
  onDialogueChange,
  onExpressionChange,
  onExpressionInstructionChange,
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
  // AI Evaluations
  aiEvaluations,
  liveSessionContext,
  audioAnswers,
  onAudioAnswerChange
}) => {
  return (
    <div>
      {/* Dialogue section */}
      <div className="mb-4 p-4 bg-gray-50 rounded-md dialogue-section">
        {dialogue.map((line, lIndex) => (
          <div key={lIndex} className="mb-1 dialogue-line">
            <span className="font-semibold">
              {isEditing ? (
                <input
                  type="text"
                  value={line.speaker}
                  onChange={e => onDialogueChange(lIndex, 'speaker', e.target.value)}
                  className="border p-1 editable-content w-32"
                />
              ) : (
                <>{line.speaker}:</>
              )}
            </span>
            <span className="leading-snug">
              {isEditing ? (
                <input
                  type="text"
                  value={line.text}
                  onChange={e => onDialogueChange(lIndex, 'text', e.target.value)}
                  className="border p-1 editable-content ml-1 w-full"
                />
              ) : (
                <> {line.text}</>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* Expressions section with 2-column grid and input under EACH expression */}
      {expressions && (
        <div>
          <p className="font-medium mb-2">
            {isEditing ? (
              <input
                type="text"
                value={expression_instruction || ""}
                onChange={e => onExpressionInstructionChange(e.target.value)}
                className="w-full border p-1 editable-content"
              />
            ) : expression_instruction}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {expressions.map((expr, eIndex) => {
              const studentAnswer = studentAnswers[eIndex] || '';
              const isEmpty = showCorrectAnswers && !studentAnswer;
              const liveAnswer = liveSessionAnswer?.[eIndex];
              // Support expressions as objects with nano_skill
              const expressionText = typeof expr === 'object' ? safeGetText(expr?.text || expr?.expression || expr) : expr;
              const nanoSkill = typeof expr === 'object' ? safeGetNanoSkill(expr) : null;
              const showNanoSkill = viewMode === 'teacher' && nanoSkill;
              
              return (
                <div key={eIndex} className="p-3 border rounded-lg bg-white">
                  <div className="flex items-start">
                    <span className="text-worksheet-purple font-medium mr-2">{eIndex + 1}.</span>
                    <div className="flex-grow">
                      {isEditing ? (
                        <input
                          type="text"
                          value={expressionText}
                          onChange={e => onExpressionChange(eIndex, e.target.value)}
                          className="border p-1 editable-content w-full"
                        />
                      ) : (
                        <span className="font-medium">{expressionText}</span>
                      )}
                    </div>
                    {/* NanoSkill Badge for expression */}
                    {showNanoSkill && (
                      <NanoSkillBadge
                        nanoSkill={nanoSkill}
                        allNanoSkills={safeGetAllNanoSkills(expr)}
                        isEditing={isEditing}
                        onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(eIndex, ns, idx) : undefined}
                      />
                    )}
                  </div>
                  
                  {/* Interactive answer input - PROBLEM 3 FIX: Auto-resize textarea */}
                  {isInteractive && (
                    <div className="mt-2">
                      <AutoResizeTextarea
                        value={studentAnswer}
                        onChange={(e) => onAnswerChange?.(eIndex, e.target.value)}
                        placeholder="Use this expression in a sentence..."
                        className={`min-h-[40px] ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                        rows={1}
                        disabled={disabled}
                      />
                      {/* AI Evaluation badge per expression */}
                      {aiEvaluations?.[eIndex] && (disabled || isSharedWorksheet) && (
                        <AiEvaluationBadge 
                          evaluation={aiEvaluations[eIndex]} 
                          showFeedback={true}
                        />
                      )}
                      {/* Speaking recorder */}
                      {onAudioAnswerChange && (
                        <HomeworkSpeakingRecorder
                          existingAudioUrl={audioAnswers?.[eIndex]}
                          onAudioSaved={(url) => onAudioAnswerChange(eIndex, url)}
                          disabled={disabled}
                        />
                      )}
                    </div>
                  )}
                  
                  {/* PROBLEM 1: Display live session answer in blue */}
                  {liveAnswer && !isInteractive && viewMode === 'teacher' && (
                    <div className="mt-2 text-blue-600 font-medium text-sm">
                      [Student: {liveAnswer}]
                    </div>
                  )}
                  {/* AI Evaluation badge for teacher/live-session view (outside interactive block) */}
                  {!isInteractive && aiEvaluations?.[eIndex] && isSharedWorksheet && (
                    <AiEvaluationBadge evaluation={aiEvaluations[eIndex]} showFeedback={true}
                      isLiveSession={!!liveSessionContext} worksheetId={liveSessionContext?.worksheetId}
                      exerciseIndex={liveSessionContext?.exerciseIndex} exerciseType={liveSessionContext?.exerciseType}
                      teacherId={liveSessionContext?.teacherId} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseDialogue;