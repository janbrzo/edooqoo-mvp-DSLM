import { safeGetText, safeGetNanoSkill } from "@/utils/textObjectFixer";
import NanoSkillBadge from "./NanoSkillBadge";

// This file contains utility functions for the ExerciseSection component

export const handleExerciseChange = (
  editableWorksheet: any, 
  setEditableWorksheet: React.Dispatch<React.SetStateAction<any>>, 
  index: number, 
  field: string, 
  value: string
) => {
  const updatedExercises = [...editableWorksheet.exercises];
  updatedExercises[index] = {
    ...updatedExercises[index],
    [field]: value
  };
  setEditableWorksheet({
    ...editableWorksheet,
    exercises: updatedExercises
  });
};

export const handleQuestionChange = (
  editableWorksheet: any, 
  setEditableWorksheet: React.Dispatch<React.SetStateAction<any>>, 
  exerciseIndex: number,
  questionIndex: number, 
  field: string, 
  value: string
) => {
  const updatedExercises = [...editableWorksheet.exercises];
  const exerciseCopy = updatedExercises[exerciseIndex];
  if (exerciseCopy.questions) {
    exerciseCopy.questions[questionIndex] = {
      ...exerciseCopy.questions[questionIndex],
      [field]: value
    };
    setEditableWorksheet({
      ...editableWorksheet,
      exercises: updatedExercises
    });
  }
};

export const handleItemChange = (
  editableWorksheet: any, 
  setEditableWorksheet: React.Dispatch<React.SetStateAction<any>>, 
  exerciseIndex: number,
  itemIndex: number, 
  field: string, 
  value: string
) => {
  const updatedExercises = [...editableWorksheet.exercises];
  const exerciseCopy = updatedExercises[exerciseIndex];
  if (exerciseCopy.items) {
    exerciseCopy.items[itemIndex] = {
      ...exerciseCopy.items[itemIndex],
      [field]: value
    };
    setEditableWorksheet({
      ...editableWorksheet,
      exercises: updatedExercises
    });
  }
};

export const handleSentenceChange = (
  editableWorksheet: any, 
  setEditableWorksheet: React.Dispatch<React.SetStateAction<any>>, 
  exerciseIndex: number,
  sentenceIndex: number, 
  field: string, 
  value: string
) => {
  const updatedExercises = [...editableWorksheet.exercises];
  const exerciseCopy = updatedExercises[exerciseIndex];
  if (exerciseCopy.sentences) {
    exerciseCopy.sentences[sentenceIndex] = {
      ...exerciseCopy.sentences[sentenceIndex],
      [field]: value
    };
    setEditableWorksheet({
      ...editableWorksheet,
      exercises: updatedExercises
    });
  }
};

export const handleExpressionChange = (
  editableWorksheet: any, 
  setEditableWorksheet: React.Dispatch<React.SetStateAction<any>>, 
  exerciseIndex: number,
  expressionIndex: number, 
  value: string
) => {
  const updatedExercises = [...editableWorksheet.exercises];
  const exerciseCopy = updatedExercises[exerciseIndex];
  if (exerciseCopy.expressions) {
    exerciseCopy.expressions[expressionIndex] = value;
    setEditableWorksheet({
      ...editableWorksheet,
      exercises: updatedExercises
    });
  }
};

export const handleTeacherTipChange = (
  editableWorksheet: any, 
  setEditableWorksheet: React.Dispatch<React.SetStateAction<any>>, 
  exerciseIndex: number,
  value: string
) => {
  const updatedExercises = [...editableWorksheet.exercises];
  updatedExercises[exerciseIndex].teacher_tip = value;
  setEditableWorksheet({
    ...editableWorksheet,
    exercises: updatedExercises
  });
};

export const handleDialogueChange = (
  editableWorksheet: any, 
  setEditableWorksheet: React.Dispatch<React.SetStateAction<any>>, 
  exerciseIndex: number,
  dialogueIndex: number, 
  field: string, 
  value: string
) => {
  const updatedExercises = [...editableWorksheet.exercises];
  const exerciseCopy = updatedExercises[exerciseIndex];
  if (exerciseCopy.dialogue) {
    exerciseCopy.dialogue[dialogueIndex] = {
      ...exerciseCopy.dialogue[dialogueIndex],
      [field]: value
    };
    setEditableWorksheet({
      ...editableWorksheet,
      exercises: updatedExercises
    });
  }
};

export const handleStatementChange = (
  editableWorksheet: any, 
  setEditableWorksheet: React.Dispatch<React.SetStateAction<any>>, 
  exerciseIndex: number,
  statementIndex: number, 
  field: string, 
  value: string | boolean
) => {
  const updatedExercises = [...editableWorksheet.exercises];
  const exerciseCopy = updatedExercises[exerciseIndex];
  if (exerciseCopy.statements) {
    exerciseCopy.statements[statementIndex] = {
      ...exerciseCopy.statements[statementIndex],
      [field]: value
    };
    setEditableWorksheet({
      ...editableWorksheet,
      exercises: updatedExercises
    });
  }
};

export const getMatchedItems = (items: any[], viewMode: 'student' | 'teacher') => {
  return viewMode === 'teacher' ? items : [...items].sort(() => Math.random() - 0.5);
};

export const renderOtherExerciseTypes = (
  exercise: any, 
  isEditing: boolean, 
  viewMode: 'student' | 'teacher',
  handleSentenceChange: (sentenceIndex: number, field: string, value: string) => void,
  // Interactive props
  isInteractive: boolean = false,
  studentAnswers: Record<number, any> = {},
  onAnswerChange?: (questionIndex: number, value: any) => void,
  showCorrectAnswers: boolean = false,
  // PROBLEM 1: Live Session answer prop for displaying student answers in blue
  liveSessionAnswer?: Record<number, any>,
  // NanoSkill edit callback
  onNanoSkillChange?: (sentenceIndex: number, newSkill: any, skillIndex?: number) => void
) => (
  <div>
    <div className="space-y-2">
      {exercise.sentences.map((sentence: any, sIndex: number) => {
        const studentAnswer = studentAnswers[sIndex] || '';
        const isEmpty = showCorrectAnswers && !studentAnswer;
        const liveAnswer = liveSessionAnswer?.[sIndex];
        // CRITICAL FIX: Use safeGetText to prevent "Cannot read properties of undefined (reading 'replace')"
        const sentenceText = safeGetText(sentence?.text ?? sentence);
        // Extract nano skill for badge display
        const nanoSkill = typeof sentence === 'object' ? safeGetNanoSkill(sentence) : null;
        const showNanoSkill = viewMode === 'teacher' && nanoSkill;
        
        return (
          <div key={sIndex} className="border rounded-lg p-3 bg-white">
            <div className="flex flex-col gap-2">
              <div className="flex-grow">
                <div className="flex items-start gap-2 flex-wrap">
                  <p className="leading-snug flex-grow">
                    {isEditing ? (
                      <input
                        type="text"
                        value={sentenceText}
                        onChange={e => handleSentenceChange(sIndex, 'text', e.target.value)}
                        className="w-full border p-1 editable-content"
                      />
                    ) : (
                      <>{sIndex + 1}. {
                        exercise.type === 'word-formation' 
                          ? sentenceText.replace(/_+/g, "_______________") 
                          : sentenceText
                      }</>
                    )}
                  </p>
                  {showNanoSkill && (
                    <NanoSkillBadge
                      nanoSkill={nanoSkill}
                      onEdit={onNanoSkillChange ? (newSkill, idx) => onNanoSkillChange(sIndex, newSkill, idx) : undefined}
                    />
                  )}
                </div>
              </div>
              {isInteractive && (
                <input
                  type="text"
                  value={studentAnswer}
                  onChange={(e) => onAnswerChange?.(sIndex, e.target.value)}
                  placeholder={exercise.type === 'error-correction' ? "Write the corrected sentence..." : "Type your answer..."}
                  className={`w-full border p-2 rounded h-10 ${isEmpty ? 'bg-red-100 border-2 border-red-400' : ''}`}
                />
              )}
              {(viewMode === 'teacher' || showCorrectAnswers) && (
                <div className="flex items-center gap-3">
                  <div className="text-green-600 italic text-sm">
                    {isEditing ? (
                      <input
                        type="text"
                        value={sentence.answer || sentence.correction}
                        onChange={e => handleSentenceChange(
                          sIndex, 
                          exercise.type === 'error-correction' ? 'correction' : 'answer', 
                          e.target.value
                        )}
                        className="border p-1 editable-content w-full"
                      />
                    ) : (
                      <span>({sentence.answer || sentence.correction})</span>
                    )}
                  </div>
                  {/* PROBLEM 1: Display live session answer in blue */}
                  {liveAnswer && (
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

export const renderTrueFalseExercise = (
  exercise: any, 
  isEditing: boolean, 
  viewMode: 'student' | 'teacher',
  handleStatementChange: (statementIndex: number, field: string, value: string | boolean) => void
) => (
<div>
    <div className="space-y-2">
      {exercise.statements.map((statement: any, sIndex: number) => {
        // CRITICAL FIX: Use safeGetText to prevent "Cannot read properties of undefined (reading 'replace')"
        const statementText = safeGetText(statement?.text ?? statement);
        
        return (
        <div key={sIndex} className="border-b pb-2">
          <div className="flex flex-row items-start">
            <div className="flex-grow">
              <p className="leading-snug">
                {isEditing ? (
                  <input
                    type="text"
                    value={statementText}
                    onChange={e => handleStatementChange(sIndex, 'text', e.target.value)}
                    className="w-full border p-1 editable-content"
                  />
                ) : (
                  <>{sIndex + 1}. {statementText}</>
                )}
              </p>
            </div>
            <div className="ml-4 flex space-x-4">
              {viewMode === 'student' ? (
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input type="radio" name={`statement-${sIndex}`} className="form-radio h-4 w-4" disabled={!isEditing} />
                    <span className="ml-2">True</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input type="radio" name={`statement-${sIndex}`} className="form-radio h-4 w-4" disabled={!isEditing} />
                    <span className="ml-2">False</span>
                  </label>
                </div>
              ) : (
                <div className="text-green-600 italic ml-3 text-sm">
                  {isEditing ? (
                    <select
                      value={statement.isTrue ? "true" : "false"}
                      onChange={e => handleStatementChange(sIndex, 'isTrue', e.target.value === "true")}
                      className="border p-1 editable-content"
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : (
                    <span>({statement.isTrue ? "True" : "False"})</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        );
      })}
    </div>
  </div>
);

