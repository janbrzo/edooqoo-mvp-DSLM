import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Brain, SkipForward, Undo2, AlertCircle, Loader2 } from "lucide-react";
import { NanoSkill } from "./NanoSkillBadge";

interface NanoSkillRating {
  name: string;
  reason: string;
  mastery: number | null; // null = no value set
  hasValue: boolean; // PROBLEM 1.2: Track if user has set a value
}

interface NanoSkillMasteryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (ratings: NanoSkillRating[]) => void;
  onSkip?: () => void;
  nanoSkills: NanoSkill[];
  exerciseTitle: string;
  // PROBLEM 1.1: Student answers and exercise data for pre-filling
  studentAnswers?: Record<number, any>;
  exerciseData?: any;
  // PROBLEM 1.2: AI evaluations for open-ended exercises
  aiEvaluations?: Record<number, number>;
  isLoadingAiEvaluation?: boolean;
}

// Undo Mark Done Modal
interface UndoMarkDoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteFromEvents: boolean) => void;
  exerciseTitle: string;
}

export const UndoMarkDoneModal: React.FC<UndoMarkDoneModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  exerciseTitle,
}) => {
  const [deleteFromEvents, setDeleteFromEvents] = useState(true);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-orange-500" />
            Undo Mark Done
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to unmark <span className="font-medium">"{exerciseTitle}"</span> as done?
          </p>

          <div className="flex items-center space-x-2 p-3 border rounded-lg bg-muted/30">
            <Checkbox
              id="delete-events"
              checked={deleteFromEvents}
              onCheckedChange={(checked) => setDeleteFromEvents(checked === true)}
            />
            <label
              htmlFor="delete-events"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Also delete mastery evaluation from student events
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onConfirm(deleteFromEvents);
              onClose();
            }} 
            variant="destructive"
            className="gap-2"
          >
            <Undo2 className="h-4 w-4" />
            Confirm Undo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// PROBLEM 1: Helper to calculate initial mastery for SPECIFIC item index
// Each nano_skill corresponds to a specific item in the exercise
const calculateInitialMasteryForItem = (
  itemIndex: number,
  studentAnswers?: Record<number, any>,
  exerciseData?: any,
  aiEvaluations?: Record<number, number>
): { mastery: number | null; hasValue: boolean } => {
  // PROBLEM 1.2: If we have AI evaluation for this item, use it
  if (aiEvaluations && aiEvaluations[itemIndex] !== undefined) {
    console.log(`[Mastery] Using AI evaluation for item ${itemIndex}: ${aiEvaluations[itemIndex]}%`);
    return { mastery: aiEvaluations[itemIndex], hasValue: true };
  }

  // No answers = slider starts with no value
  if (!studentAnswers || Object.keys(studentAnswers).length === 0) {
    return { mastery: null, hasValue: false };
  }
  
  // Get the student's answer for this specific item
  const studentAnswer = studentAnswers[itemIndex];
  
  // If no answer for this item, return no value
  if (studentAnswer === undefined || studentAnswer === null || studentAnswer === '') {
    return { mastery: null, hasValue: false };
  }
  
  // Try to determine correctness for this specific item
  let isCorrect: boolean | null = null;
  
  // Check questions array
  if (exerciseData?.questions && exerciseData.questions[itemIndex]) {
    const question = exerciseData.questions[itemIndex];
    
    // Multiple choice - check if answer matches correct option
    if (question.options && Array.isArray(question.options)) {
      const correctOption = question.options.find((o: any) => o.correct === true);
      if (correctOption) {
        isCorrect = studentAnswer === correctOption.text || 
                   studentAnswer === correctOption.label ||
                   studentAnswer === correctOption.value;
      }
    }
    
    // Odd One Out - compare with correct_answer (case-insensitive)
    if (question.correct_answer) {
      isCorrect = String(studentAnswer).toLowerCase().trim() === 
                  String(question.correct_answer).toLowerCase().trim();
      console.log(`[Mastery] Odd One Out item ${itemIndex}: student="${studentAnswer}", correct="${question.correct_answer}", isCorrect=${isCorrect}`);
    }
    
    // Reading/answer questions with expected answer
    if (question.answer || question.correct || question.expected) {
      const expected = question.answer || question.correct || question.expected;
      if (typeof studentAnswer === 'string' && typeof expected === 'string') {
        isCorrect = studentAnswer.toLowerCase().trim() === expected.toLowerCase().trim();
      }
    }
  }
  
  // Check items array (matching, categorize, synonyms/antonyms, etc.)
  if (exerciseData?.items && exerciseData.items[itemIndex]) {
    const item = exerciseData.items[itemIndex];
    if (item.match) {
      isCorrect = studentAnswer === item.match;
    }
    if (item.category) {
      isCorrect = studentAnswer === item.category;
    }
    
    // PROBLEM 2 FIX: Synonyms/Antonyms - student selects letter (A, B, C...) that matches this item
    // The correct answer is the letter corresponding to the position where the matching definition is
    if (item.definition && typeof studentAnswer === 'string') {
      // For synonyms/antonyms, items have: word, definition
      // Student selects which letter (A, B, C...) matches the word
      // The shuffled definitions are in order, so we need to find where this item's definition is
      const allDefinitions = exerciseData.items.map((i: any) => i.definition);
      const correctIndex = allDefinitions.indexOf(item.definition);
      if (correctIndex !== -1) {
        const correctLetter = String.fromCharCode(65 + correctIndex); // 0=A, 1=B, 2=C...
        isCorrect = studentAnswer.toUpperCase().trim() === correctLetter;
        console.log(`[Mastery] Synonyms/Antonyms item ${itemIndex}: word="${item.word}", student="${studentAnswer}", correctLetter="${correctLetter}", isCorrect=${isCorrect}`);
      }
    }
  }
  
  // Check sentences array (fill in blanks, transformation, etc.)
  if (exerciseData?.sentences && exerciseData.sentences[itemIndex]) {
    const sentence = exerciseData.sentences[itemIndex];
    
    // PROBLEM 2 FIX: Error Correction - check BOTH 'correct' AND 'correction' fields
    const errorCorrectionAnswer = sentence.correction || sentence.correct;
    if (errorCorrectionAnswer && !sentence.answer && !sentence.missing_word) {
      if (typeof studentAnswer === 'string') {
        isCorrect = studentAnswer.toLowerCase().trim() === errorCorrectionAnswer.toLowerCase().trim();
        console.log(`[Mastery] Error Correction item ${itemIndex}: student="${studentAnswer}", correct="${errorCorrectionAnswer}", isCorrect=${isCorrect}`);
      }
    }
    
    // PROBLEM 1.1 FIX: Word Order - compare with correct_order
    if (sentence.correct_order) {
      if (typeof studentAnswer === 'string') {
        isCorrect = studentAnswer.toLowerCase().trim() === sentence.correct_order.toLowerCase().trim();
        console.log(`[Mastery] Word Order item ${itemIndex}: student="${studentAnswer}", correct="${sentence.correct_order}", isCorrect=${isCorrect}`);
      }
    }
    
    // Standard fill in blanks
    const correctAnswer = sentence.answer || sentence.missing_word;
    if (correctAnswer && typeof studentAnswer === 'string') {
      isCorrect = studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    }
  }
  
  // PROBLEM 1.1 FIX: Check words array (Negative Prefixes, Complete Word)
  if (exerciseData?.words && exerciseData.words[itemIndex]) {
    const word = exerciseData.words[itemIndex];
    // Negative Prefixes uses 'answer', Complete Word uses 'complete' or 'complete_word'
    const correctAnswer = word.answer || word.complete || word.complete_word;
    if (correctAnswer && typeof studentAnswer === 'string') {
      isCorrect = studentAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
      console.log(`[Mastery] Words item ${itemIndex}: student="${studentAnswer}", correct="${correctAnswer}", isCorrect=${isCorrect}`);
    }
  }
  
  // PROBLEM 1.1 FIX: Check categories array (Categorize exercise)
  // For categorize, student selects a category index for each word
  if (exerciseData?.categories && exerciseData?.items) {
    // The student answer is the category index they selected
    // We need to find which category this item actually belongs to
    const item = exerciseData.items[itemIndex];
    if (item) {
      const itemWord = typeof item === 'string' ? item : (item.word || item.text);
      // Find which category contains this word in correct_items
      let correctCategoryIndex = -1;
      exerciseData.categories.forEach((cat: any, catIdx: number) => {
        if (cat.correct_items) {
          const found = cat.correct_items.some((ci: any) => {
            const ciWord = typeof ci === 'string' ? ci : (ci.word || ci.text);
            return ciWord && itemWord && ciWord.toLowerCase() === itemWord.toLowerCase();
          });
          if (found) correctCategoryIndex = catIdx;
        }
      });
      if (correctCategoryIndex !== -1) {
        const studentCatIdx = typeof studentAnswer === 'number' ? studentAnswer : parseInt(studentAnswer);
        isCorrect = studentCatIdx === correctCategoryIndex;
        console.log(`[Mastery] Categorize item ${itemIndex}: word="${itemWord}", studentCat=${studentCatIdx}, correctCat=${correctCategoryIndex}, isCorrect=${isCorrect}`);
      }
    }
  }
  
  // PROBLEM 1.1 FIX: Check statements array (true/false) - use isTrue field
  if (exerciseData?.statements && exerciseData.statements[itemIndex]) {
    const statement = exerciseData.statements[itemIndex];
    // True/False uses isTrue field, not correct
    const expectedValue = statement.isTrue;
    if (expectedValue !== undefined) {
      // Normalize student answer to boolean
      let normalizedAnswer: boolean | null = null;
      if (typeof studentAnswer === 'boolean') {
        normalizedAnswer = studentAnswer;
      } else if (studentAnswer === 'true' || studentAnswer === true) {
        normalizedAnswer = true;
      } else if (studentAnswer === 'false' || studentAnswer === false) {
        normalizedAnswer = false;
      }
      
      if (normalizedAnswer !== null) {
        isCorrect = normalizedAnswer === expectedValue;
        console.log(`[Mastery] True/False item ${itemIndex}: student=${normalizedAnswer}, expected=${expectedValue}, isCorrect=${isCorrect}`);
      }
    }
  }
  
  // PROBLEM 1.1 FIX: Check sentence_halves array (Matching Halves)
  // Calculate correct letter dynamically using the same shuffle algorithm as ExerciseMatchingHalves
  if (exerciseData?.sentence_halves && exerciseData.sentence_halves[itemIndex]) {
    const half = exerciseData.sentence_halves[itemIndex];
    const allHalves = exerciseData.sentence_halves;
    
    // Recreate the seed used in ExerciseMatchingHalves component
    const halvesKey = allHalves.map((h: any) => (h.first_half || '').trim()).join('|');
    const worksheetId = exerciseData?.worksheetId || 'default';
    const seed = `${worksheetId}-halves-${halvesKey}`;
    
    // Apply same deterministic shuffle to get shuffled indices
    const shuffleIndicesWithSeed = (length: number, seedStr: string): number[] => {
      // Seeded random number generator
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        const char = seedStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      const random = () => {
        hash = (hash * 1103515245 + 12345) & 0x7fffffff;
        return (hash % 1000) / 1000;
      };
      
      const indices = Array.from({ length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      return indices;
    };
    
    const shuffledIndices = shuffleIndicesWithSeed(allHalves.length, seed);
    
    // Find where THIS item's index appears in shuffled array to get correct letter
    const shuffledPosition = shuffledIndices.indexOf(itemIndex);
    
    if (shuffledPosition !== -1 && typeof studentAnswer === 'string') {
      const correctLetter = String.fromCharCode(65 + shuffledPosition);
      isCorrect = studentAnswer.toUpperCase() === correctLetter;
      console.log(`[Mastery] Matching Halves item ${itemIndex}: student="${studentAnswer}", shuffledPos=${shuffledPosition}, correct="${correctLetter}", isCorrect=${isCorrect}`);
    }
  }
  
  // Return mastery based on correctness
  if (isCorrect === true) {
    return { mastery: 80, hasValue: true }; // Correct answer
  } else if (isCorrect === false) {
    return { mastery: 30, hasValue: true }; // Incorrect answer
  }
  
  // Answer exists but we can't verify correctness (open-ended questions)
  return { mastery: 50, hasValue: true }; // Neutral - needs teacher evaluation
};

const NanoSkillMasteryModal: React.FC<NanoSkillMasteryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSkip,
  nanoSkills,
  exerciseTitle,
  studentAnswers,
  exerciseData,
  aiEvaluations,
  isLoadingAiEvaluation = false,
}) => {
  const [ratings, setRatings] = useState<NanoSkillRating[]>([]);
  const hasInitialized = useRef(false);

  // PROBLEM 1 FIX: Create a direct mapping from skill index to item index
  // This preserves the 1:1 relationship between skills and exercise items
  const skillToItemMapping = useMemo(() => {
    const allSkillsWithPositions: { skill: NanoSkill; itemIndex: number }[] = [];
    
    // Process exercise data to extract ALL skills with their original positions
    // This keeps the order and allows proper mapping to studentAnswers
    const processItems = (items: any[] | undefined) => {
      if (!items) return;
      items.forEach((item, idx) => {
        const ns = item?.nano_skill || item?.nanoSkill;
        if (ns && ns.name) {
          allSkillsWithPositions.push({ skill: ns, itemIndex: idx });
        }
      });
    };
    
    if (exerciseData) {
      // Process in order of priority - usually only ONE of these arrays is populated per exercise
      processItems(exerciseData.questions);
      if (allSkillsWithPositions.length === 0) processItems(exerciseData.items);
      if (allSkillsWithPositions.length === 0) processItems(exerciseData.sentences);
      if (allSkillsWithPositions.length === 0) processItems(exerciseData.statements);
      if (allSkillsWithPositions.length === 0) processItems(exerciseData.words);
      if (allSkillsWithPositions.length === 0) processItems(exerciseData.expressions);
      if (allSkillsWithPositions.length === 0) processItems(exerciseData.categories);
      if (allSkillsWithPositions.length === 0) processItems(exerciseData.sentence_halves);
      if (allSkillsWithPositions.length === 0) processItems(exerciseData.prompts);
    }
    
    console.log('[Mastery] All skills with positions:', allSkillsWithPositions.map(s => ({
      name: s.skill.name,
      itemIndex: s.itemIndex
    })));
    
    return allSkillsWithPositions;
  }, [exerciseData]);

  useEffect(() => {
    if (isOpen && nanoSkills.length > 0 && !hasInitialized.current && !isLoadingAiEvaluation) {
      // PROBLEM 1 FIX: Use direct index mapping - each skill in nanoSkills array
      // corresponds to the same position in skillToItemMapping
      setRatings(
        nanoSkills.map((skill, skillIndex) => {
          // CRITICAL: Use skill's position in the array to find corresponding item index
          // skillToItemMapping[skillIndex] gives us the original exercise item this skill came from
          const mappedItem = skillToItemMapping[skillIndex];
          const itemIndex = mappedItem?.itemIndex ?? skillIndex;
          
          // Get mastery for this SPECIFIC item based on its answer (now includes AI evaluations)
          const { mastery, hasValue } = calculateInitialMasteryForItem(itemIndex, studentAnswers, exerciseData, aiEvaluations);
          
          console.log(`[Mastery Init] SkillIndex: ${skillIndex}, Skill: ${skill.name}, ItemIndex: ${itemIndex}, Answer: ${studentAnswers?.[itemIndex]}, AI: ${aiEvaluations?.[itemIndex]}, Mastery: ${mastery}`);
          
          return {
            name: skill.name,
            reason: skill.reason,
            mastery: mastery,
            hasValue: hasValue,
          };
        })
      );
      hasInitialized.current = true;
    }
    
    // Reset when modal closes
    if (!isOpen) {
      hasInitialized.current = false;
    }
  }, [isOpen, nanoSkills, studentAnswers, exerciseData, skillToItemMapping, aiEvaluations, isLoadingAiEvaluation]);

  const handleMasteryChange = (index: number, value: number[]) => {
    setRatings(prevRatings => {
      const newRatings = [...prevRatings];
      newRatings[index] = { 
        ...newRatings[index], 
        mastery: value[0],
        hasValue: true // User has now set a value
      };
      return newRatings;
    });
  };

  const handleSubmit = () => {
    // PROBLEM 1.2: Only submit ratings that have values set
    const ratingsWithValues = ratings.filter(r => r.hasValue && r.mastery !== null);
    onSubmit(ratingsWithValues);
    onClose();
  };
  
  const handleSkip = () => {
    onSkip?.();
    onClose();
  };

  const formatSkillName = (name: string) => {
    const parts = name.split('.');
    const skillPart = parts[parts.length - 1] || name;
    return skillPart
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getMasteryColor = (mastery: number | null) => {
    if (mastery === null) return 'text-gray-400';
    if (mastery >= 80) return 'text-green-600';
    if (mastery >= 60) return 'text-yellow-600';
    if (mastery >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getMasteryLabel = (mastery: number | null) => {
    if (mastery === null) return 'Not set';
    if (mastery >= 90) return 'Excellent';
    if (mastery >= 75) return 'Good';
    if (mastery >= 60) return 'Satisfactory';
    if (mastery >= 40) return 'Needs Work';
    return 'Struggling';
  };
  
  // Count how many ratings have values
  const ratingsWithValues = ratings.filter(r => r.hasValue && r.mastery !== null).length;

  // Show modal even without nano skills (with skip option)
  if (nanoSkills.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Mark Exercise Done
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              No nano skills detected for this exercise. Mark as done without evaluation?
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSkip} className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Mark Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Evaluate Student Mastery
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Exercise: <span className="font-medium">{exerciseTitle}</span>
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* PROBLEM 4: Loading state while AI evaluates answers */}
          {isLoadingAiEvaluation && (
            <div className="flex items-center justify-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm text-blue-700">
                AI is evaluating student answers...
              </span>
            </div>
          )}
          
          {/* Only show content when NOT loading */}
          {!isLoadingAiEvaluation && (
            <>
              <p className="text-sm text-muted-foreground">
                Rate how well the student demonstrated each skill during this exercise:
              </p>
              
              {/* PROBLEM 1.2: Info about unset values */}
              {ratings.some(r => !r.hasValue) && (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  Skills without a set value won't be saved.
                </div>
              )}

              {/* FIX 3: Skip button moved to top, right after info text */}
              {onSkip && (
                <Button 
                  variant="ghost" 
                  onClick={handleSkip} 
                  className="gap-2 text-muted-foreground w-full justify-start"
                  disabled={isLoadingAiEvaluation}
                >
                  <SkipForward className="h-4 w-4" />
                  Skip (mark done without evaluation)
                </Button>
              )}
            </>
          )}

          {/* PROBLEM 4: Only show ratings when not loading */}
          {!isLoadingAiEvaluation && ratings.map((rating, index) => (
            <div 
              key={index} 
              className={`space-y-3 p-4 border rounded-lg ${rating.hasValue ? 'bg-muted/20' : 'bg-gray-50 border-dashed'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <Badge variant={rating.hasValue ? "secondary" : "outline"} className="mb-2">
                    {formatSkillName(rating.name)}
                  </Badge>
                  <p className="text-sm text-muted-foreground italic">
                    "{rating.reason}"
                  </p>
                </div>
                <div className={`text-2xl font-bold ${getMasteryColor(rating.mastery)}`}>
                  {rating.mastery !== null ? `${rating.mastery}%` : '—'}
                </div>
              </div>

              <div className="space-y-2">
                <Slider
                  value={rating.mastery !== null ? [rating.mastery] : [50]}
                  onValueChange={(value) => handleMasteryChange(index, value)}
                  max={100}
                  min={0}
                  step={5}
                  className={`w-full ${!rating.hasValue ? 'opacity-50' : ''}`}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0% - Struggling</span>
                  <span className={`font-medium ${getMasteryColor(rating.mastery)}`}>
                    {getMasteryLabel(rating.mastery)}
                  </span>
                  <span>100% - Excellent</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* PROBLEM 4: Disable buttons while loading */}
        <DialogFooter className="gap-2 flex-wrap">
          {/* Skip button removed from footer - moved to top */}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={onClose} disabled={isLoadingAiEvaluation}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="gap-2" disabled={isLoadingAiEvaluation}>
              {isLoadingAiEvaluation ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Save Evaluation {ratingsWithValues > 0 && `(${ratingsWithValues})`}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NanoSkillMasteryModal;
