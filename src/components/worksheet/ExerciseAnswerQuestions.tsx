import React, { useCallback } from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { safeGetText, safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { AiEvaluationBadge, AiEvaluation } from "@/components/homework/AiEvaluationBadge";
import { HomeworkSpeakingRecorder } from "@/components/homework/HomeworkSpeakingRecorder";
import { LiveAudioPlayer } from "./LiveAudioPlayer";

interface Question {
  text?: string;          // Old format (reading exercises)
  question?: string;      // New format (picture exercises)
  answer?: string;        // Old format (sample answers)
  focus?: string;         // New format (grammar focus)
}

interface ExerciseAnswerQuestionsProps extends Partial<InteractiveExerciseProps> {
  media_url?: string;
  media_type?: "video" | "audio" | "image";
  questions: Question[];
  showImage?: boolean;
  hideExerciseMedia?: boolean;
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onQuestionChange: (qIndex: number, field: string, value: string) => void;
  onMediaUrlChange?: (url: string) => void;
  onMediaTypeChange?: (type: "video" | "audio" | "image") => void;
  liveSessionAnswer?: Record<number, any>;
  // A3: Disable inputs after homework submission
  disabled?: boolean;
  // NanoSkill editing
  onNanoSkillChange?: (qIndex: number, nanoSkill: NanoSkill, skillIndex?: number) => void;
  isSharedWorksheet?: boolean;
  // AI Evaluations per question
  aiEvaluations?: Record<number, AiEvaluation>;
  // Exercise variant for media hints
  exerciseVariant?: 'audio' | 'picture' | 'plain';
  liveSessionContext?: { worksheetId: string; exerciseIndex: number; exerciseType: string; teacherId: string; };
  audioAnswers?: Record<number, string>;
  onAudioAnswerChange?: (questionIndex: number, audioUrl: string) => void;
  liveAudioAnswers?: Record<number, string>;
}

const ExerciseAnswerQuestions: React.FC<ExerciseAnswerQuestionsProps> = ({
  media_url,
  media_type = "image",
  questions,
  showImage = true,
  hideExerciseMedia = false,
  isEditing,
  viewMode,
  onQuestionChange,
  onMediaUrlChange,
  onMediaTypeChange,
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
  isSharedWorksheet = false,
  // AI Evaluations
  aiEvaluations,
  liveSessionContext,
  audioAnswers,
  onAudioAnswerChange,
  liveAudioAnswers
}) => {
  return (
    <div className="space-y-4">
      {/* Media section - only show if showImage is true and hideExerciseMedia is false AND (isEditing OR media_url exists) */}
      {showImage && !hideExerciseMedia && (isEditing || media_url) && (
        <div className="flex justify-center">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
          {isEditing && onMediaUrlChange && onMediaTypeChange ? (
            <div className="space-y-3">
              <select
                value={media_type}
                onChange={e => onMediaTypeChange(e.target.value as "video" | "audio" | "image")}
                className="border p-2 rounded"
              >
                <option value="image">Image</option>
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>
              <input
                type="text"
                value={media_url || ""}
                onChange={e => onMediaUrlChange(e.target.value)}
                placeholder={`Enter ${media_type} URL`}
                className="w-full border p-2 editable-content"
              />
              <p className="text-xs text-gray-500">
                Enter {media_type} URL for students to {media_type === "audio" ? "listen to" : "watch/view"}
              </p>
            </div>
          ) : (
            <>
              {media_url ? (
                <div className="max-w-full">
                  {media_type === "image" && (
                    <img src={media_url} alt="Exercise media" className="max-w-full max-h-64 mx-auto rounded" />
                  )}
                  {media_type === "video" && (
                    <video controls className="max-w-full max-h-64 mx-auto rounded">
                      <source src={media_url} />
                      Your browser does not support video.
                    </video>
                  )}
                  {media_type === "audio" && (
                    <audio controls className="w-full max-w-md">
                      <source src={media_url} />
                      Your browser does not support audio.
                    </audio>
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((question, qIndex) => {
          const studentAnswer = studentAnswers[qIndex];
          const correctAnswer = question.answer || question.focus;
          const showAsCorrect = showCorrectAnswers && studentAnswer && correctAnswer;
          // CRITICAL FIX: Use safeGetText to prevent "Cannot read properties of undefined (reading 'replace')"
          const questionText = safeGetText(question?.text ?? question?.question ?? question);
          const nanoSkill = safeGetNanoSkill(question);
          const showNanoSkill = viewMode === 'teacher' && nanoSkill;

          return (
            <div key={qIndex} className="border-b pb-3">
              <div className="flex flex-row items-start mb-2">
                <div className="flex-grow">
                  <p className="font-medium leading-snug">
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
                </div>
                {/* NanoSkill Badge */}
                {showNanoSkill && (
                  <NanoSkillBadge
                    nanoSkill={nanoSkill}
                    allNanoSkills={safeGetAllNanoSkills(question)}
                    isEditing={isEditing}
                    onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(qIndex, ns, idx) : undefined}
                  />
                )}
                {viewMode === 'teacher' && (question.answer || question.focus) && !isInteractive && (
                  <div className="flex items-center gap-2 flex-wrap ml-3">
                    <div className="text-green-600 italic text-sm">
                      {isEditing ? (
                        <input
                          type="text"
                          value={question.answer || question.focus || ''}
                          onChange={e => onQuestionChange(qIndex, question.answer ? 'answer' : 'focus', e.target.value)}
                          className="border p-1 editable-content w-full"
                        />
                      ) : (
                        <span>
                          {question.answer 
                            ? `(${question.answer})` 
                            : question.focus 
                            ? `Focus: ${question.focus}` 
                            : ''}
                        </span>
                      )}
                    </div>
                    {/* Live Session: show student answer in blue */}
                    {liveSessionAnswer?.[qIndex] !== undefined && (
                      <span className="text-blue-600 font-medium text-sm">
                        [Student: {liveSessionAnswer[qIndex]}]
                      </span>
                    )}
                    <LiveAudioPlayer audioUrl={liveAudioAnswers?.[qIndex]} />
                  </div>
                )}
              </div>

              {/* Interactive answer input - PROBLEM 3 FIX: Auto-resize textarea */}
              {isInteractive && (
                <div className="ml-4 mt-1 flex items-start gap-2">
                  {onAudioAnswerChange && (
                    <HomeworkSpeakingRecorder
                      existingAudioUrl={audioAnswers?.[qIndex]}
                      onAudioSaved={(url) => onAudioAnswerChange(qIndex, url)}
                      disabled={disabled}
                      registryKey={`aq_${qIndex}`}
                    />
                  )}
                  <div className="flex-1">
                    <AutoResizeTextarea
                      value={studentAnswer || ''}
                      onChange={(e) => onAnswerChange?.(qIndex, e.target.value)}
                      placeholder="Your answer..."
                      className={`min-h-[40px] ${showAsCorrect ? 'border-green-500' : ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                      rows={1}
                      disabled={disabled}
                    />
                    {aiEvaluations?.[qIndex] && (disabled || isSharedWorksheet) && (
                      <AiEvaluationBadge 
                        evaluation={aiEvaluations[qIndex]} 
                        showFeedback={true}
                      />
                    )}
                    {showCorrectAnswers && correctAnswer && (
                      <p className="text-green-600 text-sm mt-1 italic">
                        Suggested answer: {correctAnswer}
                      </p>
                    )}
                  </div>
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
          );
        })}
      </div>
    </div>
  );
};

export default ExerciseAnswerQuestions;