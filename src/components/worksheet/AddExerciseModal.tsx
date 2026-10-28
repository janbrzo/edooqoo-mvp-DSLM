import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useDemoContext } from "@/contexts/DemoContext";
import { devWarn } from "@/utils/logger";
import {
  NO_MEDIA_EXERCISE_IDS,
  PICTURE_EXERCISE_IDS,
  AUDIO_EXERCISE_IDS,
  EXERCISE_LABELS,
} from "@/lib/exerciseTaxonomy";
import {
  MAX_ADDITIONAL_INSTRUCTIONS_LENGTH,
  MAX_EXERCISES_PER_WORKSHEET,
  appendExercise,
  countActiveExercises,
  persistAddedExercise,
  requestNewExercise,
} from "@/services/exerciseAddService";

const labelled = (ids: readonly string[]): Record<string, string> =>
  Object.fromEntries(ids.map((id) => [id, EXERCISE_LABELS[id] ?? id]));

// Exercise types come from the shared taxonomy (same ids the generator accepts).
const GENERAL_EXERCISES = labelled(NO_MEDIA_EXERCISE_IDS);
const PICTURE_EXERCISES = labelled(PICTURE_EXERCISE_IDS);
const AUDIO_EXERCISES = labelled(AUDIO_EXERCISE_IDS);

const isDemoStorage = () => {
  try {
    return localStorage.getItem("edooqoo_demo_mode") === "true";
  } catch {
    return false;
  }
};

interface AddExerciseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worksheetId: string;
  worksheetFormData: any;
  currentExerciseCount: number;
  editableWorksheet: any;
  setEditableWorksheet: (worksheet: any | ((prev: any) => any)) => void;
  userId: string;
  worksheetHasPicture?: boolean;
  worksheetHasAudio?: boolean;
}

export function AddExerciseModal({
  open,
  onOpenChange,
  worksheetId,
  worksheetFormData,
  currentExerciseCount,
  editableWorksheet,
  setEditableWorksheet,
  userId,
  worksheetHasPicture = false,
  worksheetHasAudio = false,
}: AddExerciseModalProps) {
  const [selectedType, setSelectedType] = useState<string>("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationSeconds, setGenerationSeconds] = useState(0);

  const { isDemoMode, showDemoBlockedToast } = useDemoContext();
  // The generation takes a while: always append to the worksheet as it is when the result arrives.
  const latestWorksheetRef = useRef(editableWorksheet);
  latestWorksheetRef.current = editableWorksheet;

  const maxExercises = MAX_EXERCISES_PER_WORKSHEET;
  const canAddMore = currentExerciseCount < maxExercises;

  // Timer for generation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      setGenerationSeconds(0);
      interval = setInterval(() => setGenerationSeconds(prev => prev + 1), 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isGenerating]);

  // Build available types based on media
  const availableTypes: Record<string, string> = {
    ...GENERAL_EXERCISES,
    ...(worksheetHasPicture ? PICTURE_EXERCISES : {}),
    ...(worksheetHasAudio ? AUDIO_EXERCISES : {}),
  };

  const handleGenerate = async () => {
    if (isDemoMode || isDemoStorage()) {
      showDemoBlockedToast("Adding exercises");
      return;
    }
    if (!selectedType) {
      toast.error("Please select an exercise type");
      return;
    }
    if (!canAddMore) {
      toast.error(`Maximum ${maxExercises} exercises per worksheet`);
      return;
    }

    setIsGenerating(true);

    try {
      const generated = await requestNewExercise({
        exerciseType: selectedType,
        additionalInstructions: additionalInstructions,
        formData: worksheetFormData,
        userId,
      });

      const current = latestWorksheetRef.current;
      if (countActiveExercises(current) >= maxExercises) {
        throw new Error(`Maximum ${maxExercises} exercises per worksheet`);
      }
      const updatedWorksheet = appendExercise(current, generated, availableTypes[selectedType] ?? selectedType);

      await persistAddedExercise(worksheetId, updatedWorksheet, userId);
      setEditableWorksheet(updatedWorksheet);

      toast.success(`Exercise "${availableTypes[selectedType]}" added successfully!`);
      handleClose();
    } catch (error) {
      devWarn("[AddExerciseModal] Error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to generate exercise");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setSelectedType("");
    setAdditionalInstructions("");
    setIsGenerating(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Exercise to Worksheet
          </DialogTitle>
          <DialogDescription>
            Generate a new exercise and add it to this worksheet. 
            ({currentExerciseCount}/{maxExercises} exercises)
          </DialogDescription>
        </DialogHeader>

        {!canAddMore ? (
          <div className="py-6 text-center text-muted-foreground">
            <p className="font-medium">Maximum {maxExercises} exercises reached</p>
            <p className="text-sm mt-1">Delete an existing exercise to add a new one.</p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Exercise type selection */}
            <div className="space-y-2">
              <Label>Select Exercise Type</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-1.5">
                {Object.entries(availableTypes).map(([typeId, typeName]) => (
                  <div key={typeId} className="flex items-center space-x-2">
                    <Checkbox
                      id={`add-type-${typeId}`}
                      checked={selectedType === typeId}
                      onCheckedChange={(checked) => setSelectedType(checked ? typeId : "")}
                    />
                    <Label htmlFor={`add-type-${typeId}`} className="text-sm font-normal cursor-pointer">
                      {typeName}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Additional instructions */}
            <div className="space-y-2">
              <Label htmlFor="add-exercise-instructions">Additional Instructions (Optional)</Label>
              <Textarea
                id="add-exercise-instructions"
                placeholder="e.g., Focus on past tense, use business vocabulary..."
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value.slice(0, MAX_ADDITIONAL_INSTRUCTIONS_LENGTH))}
                maxLength={MAX_ADDITIONAL_INSTRUCTIONS_LENGTH}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Generate button */}
            <Button
              onClick={handleGenerate}
              disabled={!selectedType || isGenerating}
              className="w-full bg-worksheet-purple hover:bg-worksheet-purpleDark"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating... ({generationSeconds}s)
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate & Add Exercise
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
