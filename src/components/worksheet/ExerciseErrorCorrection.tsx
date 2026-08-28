import React from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { safeGetText } from "@/utils/textObjectFixer";
import { matchAnswer } from "@/lib/answers/matchAnswer";
import { AnswerStatusBadge, answerFieldClasses } from "./AnswerStatusBadge";


interface ExerciseErrorCorrectionProps extends Partial<InteractiveExerciseProps> {
  sentences: any[];
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onSentenceChange: (sIndex: number, field: string, value: string) => void;
  disabled?: boolean;
  isSharedWorksheet?: boolean;
}

const ExerciseErrorCorrection: React.FC<ExerciseErrorCorrectionProps> = ({
  sentences = [],
  isEditing,
  viewMode,
  onSentenceChange,
  isInteractive = false,
  studentAnswers = {},
  onAnswerChange,
  showCorrectAnswers = false,
  disabled = false,
}) => {
  return (
    <div className="space-y-3">
      {sentences.map((sentence, sIndex) => {
        const studentAnswer = studentAnswers[sIndex] || '';
        const correctAnswer =
          sentence.answer ||
          sentence.correction ||
          sentence.correct ||
          sentence.corrected ||
          sentence.correct_sentence || '';
        const match = matchAnswer(studentAnswer, correctAnswer, {
          mode: 'sentence',
          sourceSentence: safeGetText(sentence.incorrect) || safeGetText(sentence.text),
        });
        const isCorrect = showCorrectAnswers && match.verdict === 'correct';
        const isReview = showCorrectAnswers && match.verdict === 'review';
        const isIncorrect = showCorrectAnswers && match.verdict === 'wrong';
        const isEmpty = showCorrectAnswers && !studentAnswer;


        return (
          <div key={sIndex} className="border rounded-lg p-3 bg-white">
            <p className="leading-snug mb-2">
              <span className="font-medium">{sIndex + 1}.</span>{' '}
              {isEditing ? (
                <input
                  type="text"
                  value={safeGetText(sentence.incorrect) || safeGetText(sentence.text)}
                  onChange={e => onSentenceChange(sIndex, 'incorrect', e.target.value)}
                  className="w-full border p-1 editable-content"
                />
              ) : (
                safeGetText(sentence.incorrect) || safeGetText(sentence.text)
              )}
            </p>
            {isInteractive && (
              <input
                type="text"
                value={studentAnswer}
                onChange={(e) => onAnswerChange?.(sIndex, e.target.value)}
                placeholder="Write the correct sentence..."
                className={`w-full h-10 border rounded px-3
                  ${isCorrect ? 'bg-green-200 border-2 border-green-600' : ''}
                  ${isIncorrect ? 'bg-red-200 border-2 border-red-600' : ''}
                  ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
                  ${disabled ? 'bg-muted cursor-not-allowed opacity-70' : ''}
                `}
                disabled={disabled}
              />
            )}
            {showCorrectAnswers && correctAnswer && (
              <div className={`text-sm mt-1 ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                {isCorrect ? '✓ Correct!' : `✗ Correct answer: ${correctAnswer}`}
              </div>
            )}
            {(viewMode === 'teacher' || showCorrectAnswers) && isEditing && (
              <div className="text-green-600 italic text-sm mt-1">
                <input
                  type="text"
                  value={correctAnswer}
                  onChange={e => onSentenceChange(sIndex, 'answer', e.target.value)}
                  className="border p-1 editable-content w-full"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ExerciseErrorCorrection;
