
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Clock, Database, Star, Edit, GraduationCap, BookOpen, FileText, MessageSquare, Headphones, Image, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

// Exercise types mapping
const EXERCISE_TYPES_MAP: Record<string, string> = {
  'warmup': 'Warmup',
  'vocabulary': 'Vocabulary',
  'grammar': 'Grammar',
  'reading': 'Reading',
  'listening': 'Listening',
  'speaking': 'Speaking',
  'writing': 'Writing',
  'gaptext': 'Gap Text',
  'fillinblanks': 'Fill in Blanks',
  'multiplechoice': 'Multiple Choice',
  'matching': 'Matching',
  'truefalse': 'True/False',
  'wordorder': 'Word Order',
  'dialogue': 'Dialogue',
  'describe-picture': 'Describe Picture',
  'describe': 'Describe Picture',
  'answerquestions': 'Answer Questions',
  'paraphrasing': 'Paraphrasing',
  'sentencetransformation': 'Sentence Transformation',
  'oddoneout': 'Odd One Out',
  'synonymsmatching': 'Synonyms Matching',
  'antonymsmatching': 'Antonyms Matching',
  'synonymsantonyms': 'Synonyms & Antonyms',
  'matchinghalves': 'Matching Halves',
  'completeword': 'Complete Word',
  'categorize': 'Categorize',
  'negativeprefixes': 'Negative Prefixes',
  // Add hyphenated versions for backward compatibility
  'matching-halves': 'Matching Halves',
  'true-false': 'True/False',
  'gap-text': 'Gap Text',
  'fill-in-blanks': 'Fill in the Blanks',
  'synonyms': 'Synonyms Matching',
  'antonyms': 'Antonyms Matching',
  'synonyms-antonyms': 'Synonyms & Antonyms',
  'word-order': 'Word Order',
  'odd-one-out': 'Odd One Out',
  'negative-prefixes': 'Negative Prefixes',
  'multiple-choice': 'Multiple Choice',
  'discussion': 'Discussion',
  'error-correction': 'Error Correction',
  'sentence-transformation': 'Sentence Transformation',
  'complete-word': 'Complete Word',
  'answer-questions': 'Answer Questions',
  // Audio exercises
  'listening-comprehension': 'Listening Comprehension',
  'multiple-choice-audio': 'Multiple Choice (Audio)',
  'true-false-audio': 'True/False (Audio)',
  'fill-in-blanks-audio': 'Fill in the Blanks (Audio)',
  'answer-questions-audio': 'Answer Questions (Audio)',
  // Picture exercises  
  'answer-questions-picture': 'Answer Questions (Picture)',
  'multiple-choice-picture': 'Multiple Choice (Picture)',
  'true-false-picture': 'True/False (Picture)'
};

interface InputParamsCardProps {
  inputParams: {
    lessonTime: string;
    englishLevel: string;
    lessonTopic: string;
    lessonGoal: string;
    teachingPreferences?: string;
    additionalInformation?: string;
    languageStyle?: number;
  };
  selectedExercises?: string[];
  exerciseFocusMap?: Record<string, string>;
  /** 
   * Called when user clicks on an exercise name.
   * @param exerciseType - The exercise type identifier (e.g., 'odd-one-out')
   * This is used to find the correct exercise in the worksheet by type.
   */
  onExerciseClick?: (exerciseType: string) => void;
}

// Helper function to get icon for exercise type
const getExerciseIcon = (exerciseId: string): React.ReactElement => {
  // Audio exercises
  const audioExercises = [
    'listening-comprehension',
    'multiple-choice-audio',
    'true-false-audio',
    'fill-in-blanks-audio',
    'answer-questions-audio'
  ];
  
  // Picture exercises
  const pictureExercises = [
    'multiple-choice-picture',
    'true-false-picture',
    'answer-questions-picture',
    'describe-picture'
  ];
  
  if (audioExercises.includes(exerciseId)) {
    return <Headphones className="h-4 w-4 text-worksheet-purple" />;
  }
  
  if (pictureExercises.includes(exerciseId)) {
    return <Image className="h-4 w-4 text-worksheet-purple" />;
  }
  
  return <FileText className="h-4 w-4 text-worksheet-purple" />;
};

// Function to convert language style number to descriptive text
const getLanguageStyleDescription = (value: number): string => {
  if (value === 1) return "Very casual (slang, contractions)";
  if (value === 2) return "Casual (relaxed, friendly)";
  if (value === 3) return "Neutral (balanced style)";
  if (value === 4) return "Formal (professional tone)";
  return "Very formal (academic style)";
};

// Helper function to format exercise name as fallback
const formatExerciseName = (id: string): string => {
  if (EXERCISE_TYPES_MAP[id]) return EXERCISE_TYPES_MAP[id];
  // Fallback: replace hyphens with spaces and capitalize each word
  return id.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const InputParamsCard = ({ inputParams, selectedExercises, exerciseFocusMap, onExerciseClick }: InputParamsCardProps) => {
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});
  const MAX_CHARS = 55;

  // Helper to render text with truncate and "Show more" button (character-based)
  const renderTruncatableText = (fieldKey: string, text: string) => {
    if (!text) return null;

    const isExpanded = expandedFields[fieldKey];
    const needsToggle = text.length > MAX_CHARS;
    
    const displayText = !isExpanded && needsToggle
      ? text.slice(0, MAX_CHARS) + '…'
      : text;

    return (
      <div className="space-y-1">
        <p className="font-medium text-sm whitespace-pre-line">
          {displayText}
        </p>
        {needsToggle && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setExpandedFields(prev => ({ ...prev, [fieldKey]: !isExpanded }))
            }
            className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Hide
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show more
              </>
            )}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-worksheet-purple" />
          Your Input Parameters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Lesson Duration */}
          <div className="flex items-center gap-3">
            <div className="bg-worksheet-purpleLight rounded-full p-2">
              <Clock className="h-4 w-4 text-worksheet-purple" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Lesson Duration</p>
              <p className="font-medium text-sm">{inputParams.lessonTime}</p>
            </div>
          </div>
          
          {/* English Level */}
          <div className="flex items-center gap-3">
            <div className="bg-worksheet-purpleLight rounded-full p-2">
              <GraduationCap className="h-4 w-4 text-worksheet-purple" />
            </div>
            <div>
              <p className="text-sm text-gray-500">English Level</p>
              <p className="font-medium text-sm">{inputParams.englishLevel}</p>
            </div>
          </div>
          
          {/* Lesson Topic */}
          <div className="flex items-center gap-3">
            <div className="bg-worksheet-purpleLight rounded-full p-2">
              <Database className="h-4 w-4 text-worksheet-purple" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-gray-500">Lesson Topic</p>
              {renderTruncatableText('lessonTopic', inputParams.lessonTopic)}
            </div>
          </div>
        
          {/* Lesson Goal (conditionally rendered) */}
          {inputParams.lessonGoal && (
            <div className="flex items-center gap-3">
              <div className="bg-worksheet-purpleLight rounded-full p-2">
                <Star className="h-4 w-4 text-worksheet-purple" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500">Lesson Goal</p>
                {renderTruncatableText('lessonGoal', inputParams.lessonGoal)}
              </div>
            </div>
          )}
          
          {/* Grammar focus (conditionally rendered) */}
          {inputParams.teachingPreferences && (
            <div className="flex items-center gap-3">
              <div className="bg-worksheet-purpleLight rounded-full p-2">
                <BookOpen className="h-4 w-4 text-worksheet-purple" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500">Grammar focus</p>
                {renderTruncatableText('teachingPreferences', inputParams.teachingPreferences)}
              </div>
            </div>
          )}

          {/* Additional Information (conditionally rendered) */}
          {inputParams.additionalInformation && (
            <div className="flex items-center gap-3">
              <div className="bg-worksheet-purpleLight rounded-full p-2">
                <Edit className="h-4 w-4 text-worksheet-purple" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500">Additional Information</p>
                {renderTruncatableText('additionalInformation', inputParams.additionalInformation)}
              </div>
            </div>
          )}

          {/* Language Style (conditionally rendered) */}
          {inputParams.languageStyle && (
            <div className="flex items-center gap-3">
              <div className="bg-worksheet-purpleLight rounded-full p-2">
                <MessageSquare className="h-4 w-4 text-worksheet-purple" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Language Style</p>
                <p className="font-medium text-sm">
                  {getLanguageStyleDescription(inputParams.languageStyle)} ({inputParams.languageStyle}/5)
                </p>
              </div>
            </div>
          )}

          {/* Selected Exercise Types */}
          {selectedExercises && selectedExercises.length > 0 && (
            <div className="flex items-start gap-3 col-span-1">
              <div className="bg-worksheet-purpleLight rounded-full p-2 flex items-center justify-center">
                {(() => {
                  // Audio exercises
                  const audioExercises = [
                    'listening-comprehension',
                    'multiple-choice-audio',
                    'true-false-audio',
                    'fill-in-blanks-audio',
                    'answer-questions-audio'
                  ];
                  
                  // Picture exercises
                  const pictureExercises = [
                    'multiple-choice-picture',
                    'true-false-picture',
                    'answer-questions-picture',
                    'describe',
                    'describe-picture'
                  ];
                  
                  // Check if any exercise is audio
                  const hasAudioExercise = selectedExercises.some(exerciseId => 
                    audioExercises.includes(exerciseId)
                  );
                  
                  // Check if any exercise is picture
                  const hasPictureExercise = selectedExercises.some(exerciseId => 
                    pictureExercises.includes(exerciseId)
                  );
                  
                  // If both audio and picture, show FileText (or you could show both icons)
                  if (hasAudioExercise && hasPictureExercise) {
                    return <FileText className="h-4 w-4 text-worksheet-purple" />;
                  }
                  
                  // If only audio, show Headphones
                  if (hasAudioExercise) {
                    return <Headphones className="h-4 w-4 text-worksheet-purple" />;
                  }
                  
                  // If only picture, show Image
                  if (hasPictureExercise) {
                    return <Image className="h-4 w-4 text-worksheet-purple" />;
                  }
                  
                  // Default to FileText
                  return <FileText className="h-4 w-4 text-worksheet-purple" />;
                })()}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">Selected Exercise Types</p>
                <div className="font-medium text-sm">
                  {selectedExercises.map((exerciseId, index) => {
                    const exerciseName = formatExerciseName(exerciseId);
                    const isLast = index === selectedExercises.length - 1;
                    const needsNewLine = (index + 1) % 8 === 0 && !isLast;
                    const focus = exerciseFocusMap?.[exerciseId];
                    const focusTag = focus === 'vocabulary' ? '[V] ' : focus === 'grammar' ? '[G] ' : '';
                    
                      return (
                      <span key={exerciseId}>
                        {focusTag && <span className="font-bold text-worksheet-purple">{focusTag}</span>}
                        {onExerciseClick ? (
                          <button
                            type="button"
                            onClick={() => onExerciseClick(exerciseId)}
                            className="text-worksheet-purple hover:underline cursor-pointer focus:outline-none"
                          >
                            {exerciseName}
                          </button>
                        ) : (
                          exerciseName
                        )}
                        {!isLast && (needsNewLine ? <br /> : ', ')}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InputParamsCard;
