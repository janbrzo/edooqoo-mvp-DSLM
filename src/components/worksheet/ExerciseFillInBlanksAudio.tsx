import React, { useMemo } from 'react';
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { Input } from "@/components/ui/input";
import { safeGetText, safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";
import NanoSkillBadge from "./NanoSkillBadge";
import { matchAnswer } from "@/lib/answers/matchAnswer";
import { AnswerStatusBadge, answerFieldClasses } from "./AnswerStatusBadge";

interface ExerciseFillInBlanksAudioProps extends Partial<InteractiveExerciseProps> {
  word_bank?: string[];
  sentences?: any[];
  transcript_with_blanks?: string;
  answers?: string[];
  audio_url?: string;
  isEditing: boolean;
  viewMode: "student" | "teacher" | "live-session";
  onTranscriptChange?: (value: string) => void;
  onAnswersChange?: (value: string) => void;
  onWordBankChange?: (wIndex: number, value: string) => void;
  onSentenceChange?: (sIndex: number, field: string, value: string) => void;
  onNanoSkillChange?: (sIndex: number, nanoSkill: any, skillIndex?: number) => void;
  liveSessionAnswer?: Record<number, any>;
  disabled?: boolean;
}

const ExerciseFillInBlanksAudio: React.FC<ExerciseFillInBlanksAudioProps> = ({
  word_bank,
  sentences,
  transcript_with_blanks = "",
  answers = [],
  audio_url,
  isEditing,
  viewMode,
  onTranscriptChange,
  onAnswersChange,
  onWordBankChange,
  onSentenceChange,
  onNanoSkillChange,
  liveSessionAnswer,
  // Interactive props
  isInteractive = false,
  studentAnswers = {},
  onAnswerChange,
  showCorrectAnswers = false,
  disabled = false
}) => {
  // Use new structure if available, fallback to old
  const useNewStructure = sentences && sentences.length > 0;

  // Seeded shuffle for word bank (same approach as ExerciseFillInBlanks)
  const shuffledWordBank = useMemo(() => {
    if (!word_bank || isEditing) return word_bank;
    const str = word_bank.join('|');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    const seed = Math.abs(hash);
    const shuffled = [...word_bank];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = ((seed * (i + 1)) % (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [word_bank, isEditing]);

  const displayWordBank = isEditing ? word_bank : shuffledWordBank;
  
  // Show NanoSkill badges in teacher or live-session mode
  const showNanoSkillBadges = viewMode === 'teacher' || viewMode === 'live-session';

  // NEW STRUCTURE (sentences + word_bank) - like basic Fill in Blanks
  if (useNewStructure) {
    return (
      <div>
        {!audio_url && (
          <div className="text-center text-sm text-muted-foreground py-2 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            🎧 Listen to the audio in the Lesson Media section above before answering
          </div>
        )}
        
        {displayWordBank && (
          <div className="mb-4 p-3 bg-worksheet-purpleLight rounded-md word-bank-container">
            <p className="font-medium mb-2">Word Bank:</p>
            <div className="flex flex-wrap gap-2">
              {displayWordBank.map((word, wIndex) => (
                <span key={wIndex} className="bg-white px-2 py-1 rounded-md text-sm">
                  {isEditing && onWordBankChange ? (
                    <input
                      type="text"
                      value={word}
                      onChange={e => onWordBankChange(wIndex, e.target.value)}
                      className="border-0 bg-transparent p-0 w-full focus:outline-none focus:ring-0"
                    />
                  ) : word}
                </span>
              ))}
            </div>
          </div>
        )}
        
        <div className="space-y-2">
          {sentences!.map((sentence, sIndex) => {
            const studentAnswer = studentAnswers[sIndex];
            const correctAnswer = sentence.answer;
            const match = matchAnswer(studentAnswer, correctAnswer, { mode: 'word' });
            const isCorrect = showCorrectAnswers && match.verdict === 'correct';
            const isReview = showCorrectAnswers && match.verdict === 'review';
            const isIncorrect = showCorrectAnswers && match.verdict === 'wrong';
            const isEmpty = showCorrectAnswers && !studentAnswer;
            // CRITICAL FIX: Use safeGetText to prevent "Cannot read properties of undefined (reading 'replace')"
            const sentenceText = safeGetText(sentence?.text ?? sentence);

            // Extract nano_skill for display
            const nanoSkill = safeGetNanoSkill(sentence);
            
            return (
              <div key={sIndex} className="border rounded-lg p-3 bg-white">
                <div className="flex flex-row items-start gap-2">
                  <div className="flex-grow">
                    <p className="leading-snug mb-2">
                      {isEditing && onSentenceChange ? (
                        <input
                          type="text"
                          value={sentenceText}
                          onChange={e => onSentenceChange(sIndex, 'text', e.target.value)}
                          className="w-full border p-1 editable-content"
                        />
                      ) : isInteractive ? (
                        <span>
                          {sIndex + 1}. {sentenceText.split(/_+/).map((part: string, pIndex: number, arr: string[]) => (
                            <React.Fragment key={pIndex}>
                              {part}
                              {pIndex < arr.length - 1 && (
                                <Input
                                  value={studentAnswer || ''}
                                  onChange={(e) => onAnswerChange?.(sIndex, e.target.value)}
                                  disabled={disabled}
                                  className={`inline-block w-32 mx-1 h-7 
                                    ${isCorrect ? answerFieldClasses('correct') : ''}
                                    ${isReview ? answerFieldClasses('review') : ''}
                                    ${isIncorrect ? answerFieldClasses('wrong') : ''}
                                    ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
                                    ${disabled ? 'opacity-70' : ''}
                                  `}
                                  placeholder="..."
                                />
                              )}
                            </React.Fragment>
                          ))}
                        </span>
                      ) : (
                        <>{sIndex + 1}. {sentenceText.replace(/_+/g, "_______________")}</>
                      )}
                    </p>
                    
                    {/* NanoSkill Badge */}
                    {showNanoSkillBadges && nanoSkill && (
                      <div className="mt-1">
                        <NanoSkillBadge
                          nanoSkill={nanoSkill}
                          allNanoSkills={safeGetAllNanoSkills(sentence)}
                          isEditing={isEditing}
                          onEdit={onNanoSkillChange ? (newSkill, idx) => onNanoSkillChange(sIndex, newSkill, idx) : undefined}
                          className="text-xs"
                        />
                      </div>
                    )}
                  </div>
                  {(viewMode === 'teacher' || viewMode === 'live-session' || showCorrectAnswers) && !isInteractive && (
                    <div className="text-green-600 italic ml-3 text-sm">
                      {isEditing && onSentenceChange ? (
                        <input
                          type="text"
                          value={sentence.answer}
                          onChange={e => onSentenceChange(sIndex, 'answer', e.target.value)}
                          className="border p-1 editable-content w-full"
                        />
                      ) : (
                        <span>({sentence.answer})</span>
                      )}
                    </div>
                  )}
                  {showCorrectAnswers && isInteractive && (
                    <div className="text-sm font-medium">
                      <AnswerStatusBadge
                        verdict={match.verdict}
                        expected={isCorrect ? undefined : correctAnswer}
                      />
                    </div>
                  )}
                  {/* Live Session: show student answer in blue */}
                  {liveSessionAnswer?.[sIndex] && !isInteractive && (
                    <span className="text-blue-600 font-medium text-sm">
                      [Student: {liveSessionAnswer[sIndex]}]
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // OLD STRUCTURE (backward compatibility only)
  if (!useNewStructure) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          ⚠️ This exercise uses an old data format. Please regenerate the exercise to see the updated layout.
        </p>
      </div>
    );
  }

  // This should never be reached as useNewStructure check handles it above
  return null;
};

export default ExerciseFillInBlanksAudio;
