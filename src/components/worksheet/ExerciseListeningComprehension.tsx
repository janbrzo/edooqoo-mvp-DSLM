import React from 'react';
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { Input } from "@/components/ui/input";
import { safeGetText, safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { AiEvaluationBadge, AiEvaluation } from "@/components/homework/AiEvaluationBadge";
import { HomeworkSpeakingRecorder } from "@/components/homework/HomeworkSpeakingRecorder";
import { LiveAudioPlayer } from "./LiveAudioPlayer";

interface ExerciseListeningComprehensionProps extends Partial<InteractiveExerciseProps> {
  questions?: Array<{ text: string; answer: string }>;
  audio_url?: string;
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onQuestionChange: (qIndex: number, field: string, value: string) => void;
  liveSessionAnswer?: Record<number, any>;
  disabled?: boolean;
  // NanoSkill editing
  onNanoSkillChange?: (qIndex: number, nanoSkill: NanoSkill, skillIndex?: number) => void;
  isSharedWorksheet?: boolean;
  // AI Evaluations per question
  aiEvaluations?: Record<number, AiEvaluation>;
  liveSessionContext?: { worksheetId: string; exerciseIndex: number; exerciseType: string; teacherId: string; };
  audioAnswers?: Record<number, string>;
  onAudioAnswerChange?: (questionIndex: number, audioUrl: string) => void;
  liveAudioAnswers?: Record<number, string>;
}

const ExerciseListeningComprehension: React.FC<ExerciseListeningComprehensionProps> = ({
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
  showCorrectAnswers = false,
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
    <div className="space-y-2">
      {!audio_url && (
        <div className="text-center text-sm text-muted-foreground py-2 bg-blue-50 border border-blue-200 rounded-lg mb-2">
          🎧 Listen to the audio in the Lesson Media section above before answering
        </div>
      )}
      
      {questions.map((q, qIndex) => {
        const studentAnswer = studentAnswers[qIndex] || '';
        const isEmpty = showCorrectAnswers && !studentAnswer;
        const questionText = safeGetText(q.text);
        const nanoSkill = safeGetNanoSkill(q);
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
                        value={q.text}
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
                      allNanoSkills={safeGetAllNanoSkills(q)}
                      isEditing={isEditing}
                      onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(qIndex, ns, idx) : undefined}
                    />
                  )}
                </div>
              </div>
              {isInteractive && (
                <div className="flex items-start gap-2">
                  {onAudioAnswerChange && (
                    <HomeworkSpeakingRecorder
                      existingAudioUrl={audioAnswers?.[qIndex]}
                      onAudioSaved={(url) => onAudioAnswerChange(qIndex, url)}
                      disabled={disabled}
                      registryKey={`lc_${qIndex}`}
                    />
                  )}
                  <div className="flex-1">
                    <Input
                      value={studentAnswer}
                      onChange={(e) => onAnswerChange?.(qIndex, e.target.value)}
                      placeholder="Type your answer..."
                      disabled={disabled}
                      className={`h-10 
                        ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
                        ${disabled ? 'bg-muted cursor-not-allowed opacity-70' : ''}
                      `}
                    />
                  </div>
                </div>
              )}
              {(viewMode === 'teacher' || showCorrectAnswers) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-green-600 italic text-sm">
                    {isEditing ? (
                      <input
                        type="text"
                        value={q.answer}
                        onChange={e => onQuestionChange(qIndex, 'answer', e.target.value)}
                        className="border p-1 editable-content w-full"
                      />
                    ) : (
                      <span>Suggested answer: {q.answer}</span>
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
              {/* AI Evaluation badge - AFTER suggested answer and student answer (for both interactive and non-interactive) */}
              {aiEvaluations?.[qIndex] && (disabled || isSharedWorksheet) && isInteractive && (
                <AiEvaluationBadge 
                  evaluation={aiEvaluations[qIndex]} 
                  showFeedback={true}
                />
              )}
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
};

export default ExerciseListeningComprehension;
