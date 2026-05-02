import React from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { safeGetText, safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { AiEvaluationBadge, AiEvaluation } from "@/components/homework/AiEvaluationBadge";
import { HomeworkSpeakingRecorder } from "@/components/homework/HomeworkSpeakingRecorder";
import { LiveAudioPlayer } from "./LiveAudioPlayer";

interface ExerciseReadingProps extends Partial<InteractiveExerciseProps> {
  questions: any[];
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onQuestionChange: (qIndex: number, field: string, value: string) => void;
  // PROBLEM 1: Live Session answer prop for displaying student answers in blue
  liveSessionAnswer?: Record<number, any>;
  disabled?: boolean;
  // NanoSkill editing
  onNanoSkillChange?: (qIndex: number, nanoSkill: NanoSkill, skillIndex?: number) => void;
  isSharedWorksheet?: boolean;
  // AI Evaluations per question
  aiEvaluations?: Record<number, AiEvaluation>;
  // Live Session feedback context
  liveSessionContext?: { worksheetId: string; exerciseIndex: number; exerciseType: string; teacherId: string; };
  // Speaking recorder
  audioAnswers?: Record<number, string>;
  onAudioAnswerChange?: (questionIndex: number, audioUrl: string) => void;
  // Live Session: student audio answers for teacher view
  liveAudioAnswers?: Record<number, string>;
}

const ExerciseReading: React.FC<ExerciseReadingProps> = ({
  questions, 
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
  // NanoSkill props
  onNanoSkillChange,
  isSharedWorksheet = false,
  // AI Evaluations
  aiEvaluations,
  liveSessionContext,
  // Speaking
  audioAnswers,
  onAudioAnswerChange,
  liveAudioAnswers
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    {questions.map((question, qIndex) => {
      const studentAnswer = studentAnswers[qIndex] || '';
      const isEmpty = showCorrectAnswers && !studentAnswer;
      const liveAnswer = liveSessionAnswer?.[qIndex];
      // CRITICAL FIX: Use safeGetText to prevent "Cannot read properties of undefined (reading 'replace')"
      const questionText = safeGetText(question?.text ?? question);
      const nanoSkill = safeGetNanoSkill(question);
      const showNanoSkill = viewMode === 'teacher' && nanoSkill;
      
      return (
        <div key={qIndex} className="border rounded-lg p-3 bg-white">
          <div className="flex flex-col gap-2">
            <div className="flex-grow">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium leading-snug flex-grow">
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
            {/* PROBLEM 3 FIX: Auto-resize textarea */}
            {isInteractive && (
              <>
                <AutoResizeTextarea
                  value={studentAnswer}
                  onChange={(e) => onAnswerChange?.(qIndex, e.target.value)}
                  placeholder="Type your answer..."
                  disabled={disabled}
                  className={`min-h-[40px]
                    ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
                    ${disabled ? 'bg-muted cursor-not-allowed opacity-70' : ''}
                  `}
                  rows={1}
                />
                {/* AI Evaluation badge per question */}
                {aiEvaluations?.[qIndex] && (disabled || isSharedWorksheet) && (
                  <AiEvaluationBadge 
                    evaluation={aiEvaluations[qIndex]} 
                    showFeedback={true}
                  />
                )}
                {/* Speaking recorder */}
                {onAudioAnswerChange && (
                  <HomeworkSpeakingRecorder
                    existingAudioUrl={audioAnswers?.[qIndex]}
                    onAudioSaved={(url) => onAudioAnswerChange(qIndex, url)}
                    disabled={disabled}
                  />
                )}
              </>
            )}
            {(viewMode === 'teacher' || showCorrectAnswers) && (
              <div className="flex items-center gap-3">
                <span className="text-green-600 italic text-sm">
                  {isEditing ? (
                    <input
                      type="text"
                      value={question.answer}
                      onChange={e => onQuestionChange(qIndex, 'answer', e.target.value)}
                      className="border p-1 editable-content w-full"
                    />
                  ) : (
                    <>Suggested answer: {question.answer}</>
                  )}
                </span>
                {/* PROBLEM 1: Display live session answer in blue */}
                {liveAnswer && (
                  <span className="text-blue-600 font-medium text-sm">
                    [Student: {liveAnswer}]
                  </span>
                )}
                <LiveAudioPlayer audioUrl={liveAudioAnswers?.[qIndex]} />
              </div>
            )}
            {/* AI Evaluation badge for teacher/live-session view (outside interactive block) */}
            {!isInteractive && aiEvaluations?.[qIndex] && isSharedWorksheet && (
              <AiEvaluationBadge evaluation={aiEvaluations[qIndex]} showFeedback={true}
                isLiveSession={!!liveSessionContext} worksheetId={liveSessionContext?.worksheetId}
                exerciseIndex={liveSessionContext?.exerciseIndex} exerciseType={liveSessionContext?.exerciseType}
                teacherId={liveSessionContext?.teacherId} />
            )}
          </div>
        </div>
      );
    })}
  </div>
);

export default ExerciseReading;
