import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { devLog } from '@/utils/logger';
import { calculateInitialMasteryForItem } from '@/utils/masteryCalculator';
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
    
    devLog('[Mastery] All skills with positions:', allSkillsWithPositions.map(s => ({
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
          
          devLog(`[Mastery Init] SkillIndex: ${skillIndex}, Skill: ${skill.name}, ItemIndex: ${itemIndex}, Answer: ${studentAnswers?.[itemIndex]}, AI: ${aiEvaluations?.[itemIndex]}, Mastery: ${mastery}`);
          
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
                  {rating.mastery !== null ? `${rating.mastery}%` : '-'}
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
