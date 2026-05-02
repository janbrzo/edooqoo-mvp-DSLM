import React from 'react';
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { Input } from "@/components/ui/input";
import { safeGetNanoSkill, safeGetText, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { AiEvaluationBadge, AiEvaluation } from "@/components/homework/AiEvaluationBadge";
import { HomeworkSpeakingRecorder } from "@/components/homework/HomeworkSpeakingRecorder";
import { LiveAudioPlayer } from "./LiveAudioPlayer";

interface Question {
  question: string;
  focus: string;
  nano_skill?: NanoSkill;
}

interface ExerciseAnswerQuestionsAudioProps extends Partial<InteractiveExerciseProps> {
  questions?: Question[];
  audio_url?: string;
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onQuestionChange: (qIndex: number, field: string, value: string) => void;
  liveSessionAnswer?: Record<number, any>;
  disabled?: boolean;
  onNanoSkillChange?: (qIndex: number, newSkill: NanoSkill, skillIndex?: number) => void;
  isSharedWorksheet?: boolean;
  // AI Evaluations per question
  aiEvaluations?: Record<number, AiEvaluation>;
  liveSessionContext?: { worksheetId: string; exerciseIndex: number; exerciseType: string; teacherId: string; };
  audioAnswers?: Record<number, string>;
  onAudioAnswerChange?: (questionIndex: number, audioUrl: string) => void;
  liveAudioAnswers?: Record<number, string>;
}

const ExerciseAnswerQuestionsAudio: React.FC<ExerciseAnswerQuestionsAudioProps> = ({
  questions = [],
  audio_url,
  isEditing,
  viewMode,
  onQuestionChange,
  liveSessionAnswer,
  // Interactive props
  isInteractive = false,
  studentAnswers = {},
  onAnswerChange,
  disabled = false,
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
    <div className="space-y-0.5">
      {!audio_url && (
        <div className="text-center text-sm text-muted-foreground py-2 bg-blue-50 border border-blue-200 rounded-lg mb-2">
          🎧 Listen to the audio in the Lesson Media section above before answering
        </div>
      )}
      
      {questions.map((q, qIndex) => {
        // Extract nano_skill from question object
        const nanoSkill = safeGetNanoSkill(q);
        const questionText = typeof q === 'object' ? (q.question || safeGetText(q)) : String(q);
        
        return (
          <div key={qIndex} className="border-b pb-3 space-y-2">
            <div className="flex flex-row items-start">
              <div className="flex-grow">
                <p className="font-medium leading-snug">
                  {isEditing ? (
                    <input
                      type="text"
                      value={questionText}
                      onChange={e => onQuestionChange(qIndex, 'question', e.target.value)}
                      className="w-full border p-1 editable-content"
                    />
                  ) : (
                    <>{qIndex + 1}. {questionText}</>
                  )}
                </p>
              </div>
              {viewMode === 'teacher' && (
                <div className="flex items-center gap-2 flex-wrap ml-3">
                  <div className="text-green-600 italic text-sm">
                    {isEditing ? (
                      <input
                        type="text"
                        value={q.focus || ''}
                        onChange={e => onQuestionChange(qIndex, 'focus', e.target.value)}
                        className="border p-1 editable-content w-full"
                      />
                    ) : (
                      q.focus && <span>Focus: {q.focus}</span>
                    )}
                  </div>
                  {/* NanoSkill Badge */}
                  {nanoSkill && (
                    <NanoSkillBadge
                      nanoSkill={nanoSkill}
                      allNanoSkills={safeGetAllNanoSkills(q)}
                      isEditing={isEditing}
                      onEdit={onNanoSkillChange ? (newSkill, idx) => onNanoSkillChange(qIndex, newSkill, idx) : undefined}
                    />
                  )}
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
            {isInteractive && (
              <div className="flex items-start gap-2 mt-1">
                {onAudioAnswerChange && (
                  <HomeworkSpeakingRecorder
                    existingAudioUrl={audioAnswers?.[qIndex]}
                    onAudioSaved={(url) => onAudioAnswerChange(qIndex, url)}
                    disabled={disabled}
                    registryKey={`aqa_${qIndex}`}
                  />
                )}
                <div className="flex-1">
                  <Input
                    value={studentAnswers[qIndex] || ''}
                    onChange={(e) => onAnswerChange?.(qIndex, e.target.value)}
                    placeholder="Your answer..."
                    disabled={disabled}
                    className={`h-10 ${disabled ? 'bg-muted cursor-not-allowed opacity-70' : ''}`}
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
  );
};

export default ExerciseAnswerQuestionsAudio;
