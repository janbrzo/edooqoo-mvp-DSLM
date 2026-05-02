import React from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { AutoResizeTextarea } from "@/components/ui/AutoResizeTextarea";
import { safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { AiEvaluationBadge, AiEvaluation } from "@/components/homework/AiEvaluationBadge";
import { HomeworkSpeakingRecorder } from "@/components/homework/HomeworkSpeakingRecorder";
import { LiveAudioPlayer } from "./LiveAudioPlayer";

interface ExerciseDescribeProps extends Partial<InteractiveExerciseProps> {
  image_url?: string;
  questions?: any[];
  showImage?: boolean;
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onQuestionChange: (qIndex: number, field: string, value: string) => void;
  onImageUrlChange?: (url: string) => void;
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

const ExerciseDescribe: React.FC<ExerciseDescribeProps> = ({
  image_url,
  questions,
  showImage = true,
  isEditing,
  viewMode,
  onQuestionChange,
  onImageUrlChange,
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
  // Exercise variant
  exerciseVariant = 'plain',
  liveSessionContext,
  audioAnswers,
  onAudioAnswerChange,
  liveAudioAnswers
}) => {
  return (
    <div className="space-y-4">
      {/* Picture hint for picture variant */}
      {exerciseVariant === 'picture' && (
        <div className="text-center text-sm text-muted-foreground py-2 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          🖼️ Look at the picture in the Lesson Media section above before answering
        </div>
      )}
      {/* Image is displayed in MediaSection above - no duplicate needed */}
      {showImage && !image_url && exerciseVariant !== 'picture' && (
        <div className="text-center text-sm text-muted-foreground py-2">
          ℹ️ Refer to the image in the Lesson Media section above
        </div>
      )}

      {/* Guiding questions with interactive input under EACH question */}
      {questions && questions.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-700">Guiding questions:</h4>
          {questions.map((question, qIndex) => {
            const questionText = typeof question === 'string' ? question : (question.text || question.question || '');
            const studentAnswer = studentAnswers[qIndex];
            const liveAnswer = liveSessionAnswer?.[qIndex];
            const nanoSkill = safeGetNanoSkill(question);
            const showNanoSkill = viewMode === 'teacher' && nanoSkill;
            
            return (
              <div key={qIndex} className="border-b pb-2">
                <div className="flex items-start gap-2 flex-wrap">
                  <p className="leading-snug mb-1 flex-grow">
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
                      allNanoSkills={safeGetAllNanoSkills(prompt)}
                      isEditing={isEditing}
                      onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(qIndex, ns, idx) : undefined}
                    />
                  )}
                  {/* Live Session: show student answer in blue for teacher view */}
                  {viewMode === 'teacher' && liveAnswer !== undefined && (
                    <span className="text-blue-600 font-medium text-sm">
                      [Student: {liveAnswer}]
                    </span>
                  )}
                  <LiveAudioPlayer audioUrl={liveAudioAnswers?.[qIndex]} />
                </div>
                
                {/* Interactive answer input - PROBLEM 3 FIX: Auto-resize textarea */}
                {isInteractive && (
                  <div className="ml-4 mt-1 flex items-start gap-2">
                    {onAudioAnswerChange && (
                      <HomeworkSpeakingRecorder
                        existingAudioUrl={audioAnswers?.[qIndex]}
                        onAudioSaved={(url) => onAudioAnswerChange(qIndex, url)}
                        disabled={disabled}
                        registryKey={`desc_${qIndex}`}
                      />
                    )}
                    <div className="flex-1">
                      <AutoResizeTextarea
                        value={studentAnswer || ''}
                        onChange={(e) => onAnswerChange?.(qIndex, e.target.value)}
                        placeholder="Your answer..."
                        className={`min-h-[40px] ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                        rows={1}
                        disabled={disabled}
                      />
                      {aiEvaluations?.[qIndex] && (disabled || isSharedWorksheet) && (
                        <AiEvaluationBadge 
                          evaluation={aiEvaluations[qIndex]} 
                          showFeedback={true}
                        />
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
      )}

      {/* If no guiding questions, show single description field */}
      {isInteractive && (!questions || questions.length === 0) && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Describe the image:</h4>
          <AutoResizeTextarea
            value={studentAnswers[0] || ''}
            onChange={(e) => onAnswerChange?.(0, e.target.value)}
            placeholder="Write your description here..."
            className={`min-h-[40px] ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            rows={1}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
};

export default ExerciseDescribe;
