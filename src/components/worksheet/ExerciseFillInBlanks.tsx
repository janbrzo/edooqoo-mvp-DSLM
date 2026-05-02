import React, { useMemo } from "react";
import { InteractiveExerciseProps } from "@/types/interactiveHomework";
import { Input } from "@/components/ui/input";
import { answersMatch } from "@/utils/textNormalization";
import NanoSkillBadge, { NanoSkill } from "./NanoSkillBadge";
import { safeGetText, safeGetNanoSkill, safeGetAllNanoSkills } from "@/utils/textObjectFixer";

interface ExerciseFillInBlanksProps extends Partial<InteractiveExerciseProps> {
  word_bank?: string[];
  sentences: any[];
  isEditing: boolean;
  viewMode: "student" | "teacher";
  onWordBankChange: (wIndex: number, value: string) => void;
  onSentenceChange: (sIndex: number, field: string, value: string) => void;
  // PROBLEM 1: Live Session answer prop for displaying student answers in blue
  liveSessionAnswer?: Record<number, any>;
  disabled?: boolean;
  // For NanoSkill editing
  onNanoSkillChange?: (sIndex: number, nanoSkill: NanoSkill, skillIndex?: number) => void;
  // Hide nano skills on shared worksheets
  isSharedWorksheet?: boolean;
}

// PROBLEM 9 FIX: Seeded random function for deterministic shuffle
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Generate a hash from string for seed
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const ExerciseFillInBlanks: React.FC<ExerciseFillInBlanksProps> = ({
  word_bank, 
  sentences, 
  isEditing, 
  viewMode, 
  onWordBankChange, 
  onSentenceChange,
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
  isSharedWorksheet = false
}) => {
  // PROBLEM 9 FIX: Shuffle word bank with deterministic seed based on content
  const shuffledWordBank = useMemo(() => {
    if (!word_bank || isEditing) return word_bank;
    
    // Create seed from word_bank content - same content = same shuffle
    const seed = hashString(word_bank.join('|'));
    
    const shuffled = [...word_bank];
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Use seeded random instead of Math.random()
      const j = Math.floor(seededRandom(seed + i) * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [word_bank, isEditing]);

  const displayWordBank = isEditing ? word_bank : shuffledWordBank;

  return (
    <div>
      {displayWordBank && (
        <div className="mb-4 p-3 bg-worksheet-purpleLight rounded-md word-bank-container">
          <p className="font-medium mb-2">Word Bank:</p>
          <div className="flex flex-wrap gap-2">
            {displayWordBank.map((word, wIndex) => (
              <span key={wIndex} className="bg-white px-2 py-1 rounded-md text-sm">
                {isEditing ? (
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
      {sentences.map((sentence, sIndex) => {
          // Safely extract text and nano_skill
          const sentenceText = safeGetText(sentence.text || sentence);
          const nanoSkill = safeGetNanoSkill(sentence);
          const studentAnswer = studentAnswers[sIndex] || '';
          const correctAnswer = sentence.answer;
          // Use normalized comparison to ignore punctuation and case
          const isCorrect = showCorrectAnswers && answersMatch(studentAnswer, correctAnswer);
          const isIncorrect = showCorrectAnswers && studentAnswer && !isCorrect;
          const isEmpty = showCorrectAnswers && !studentAnswer;
          const liveAnswer = liveSessionAnswer?.[sIndex];
          const showNanoSkill = viewMode === 'teacher' && nanoSkill;

          return (
            <div key={sIndex} className="border rounded-lg p-3 bg-white">
              <div className="flex flex-row items-start gap-2">
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="leading-snug flex-grow">
                      {isEditing ? (
                        <input
                          type="text"
                          value={typeof sentence.text === 'string' ? sentence.text : sentenceText}
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
                                    ${isCorrect ? 'bg-green-200 border-2 border-green-600' : ''}
                                    ${isIncorrect ? 'bg-red-200 border-2 border-red-600' : ''}
                                    ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}
                                    ${disabled ? 'opacity-70' : ''}
                                  `}
                                  placeholder="..."
                                />
                              )}
                            </React.Fragment>
                          ))}
                          {showCorrectAnswers && (
                            <span className={`ml-2 text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                              {isCorrect ? '✓ Correct' : <>✗ ({correctAnswer})</>}
                            </span>
                          )}
                        </span>
                      ) : (
                        <>{sIndex + 1}. {sentenceText.replace(/_+/g, "_______________")}</>
                      )}
                    </p>
                    {/* NanoSkill Badge - only for teachers, not on shared worksheets */}
                    {showNanoSkill && (
                      <NanoSkillBadge
                        nanoSkill={nanoSkill}
                        allNanoSkills={safeGetAllNanoSkills(sentence)}
                        isEditing={isEditing}
                        onEdit={onNanoSkillChange ? (ns, idx) => onNanoSkillChange(sIndex, ns, idx) : undefined}
                      />
                    )}
                  </div>
                </div>
              {(viewMode === 'teacher' || showCorrectAnswers) && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-green-600 italic text-sm min-w-[120px]">
                      {isEditing ? (
                        <input
                          type="text"
                          value={sentence.answer}
                          onChange={e => onSentenceChange(sIndex, 'answer', e.target.value)}
                          className="border p-1 editable-content w-full"
                        />
                      ) : (
                        <>({correctAnswer})</>
                      )}
                    </span>
                    {/* Live Session: show student answer in blue */}
                    {liveAnswer && !isInteractive && (
                      <span className="text-blue-600 font-medium text-sm">
                        [Student: {liveAnswer}]
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

export default ExerciseFillInBlanks;
