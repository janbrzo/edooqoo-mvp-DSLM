import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Exercise types available for generation
const GENERAL_EXERCISES: Record<string, string> = {
  'fill-in-blanks': 'Fill in the Blanks',
  'multiple-choice': 'Multiple Choice',
  'matching': 'Matching',
  'true-false': 'True/False',
  'word-order': 'Word Order',
  'gap-text': 'Gap Text',
  'answer-questions': 'Answer Questions',
  'paraphrasing': 'Paraphrasing',
  'sentence-transformation': 'Sentence Transformation',
  'odd-one-out': 'Odd One Out',
  'synonyms-antonyms': 'Synonyms & Antonyms',
  'matching-halves': 'Matching Halves',
  'complete-word': 'Complete Word',
  'categorize': 'Categorize',
  'negative-prefixes': 'Negative Prefixes',
  'dialogue': 'Dialogue Practice',
  'discussion': 'Discussion Questions',
  'error-correction': 'Error Correction',
  'reading': 'Reading Comprehension',
};

const PICTURE_EXERCISES: Record<string, string> = {
  'describe-picture': 'Describe Picture',
  'answer-questions-picture': 'Answer Questions (Picture)',
  'true-false-picture': 'True/False (Picture)',
  'multiple-choice-picture': 'Multiple Choice (Picture)',
};

const AUDIO_EXERCISES: Record<string, string> = {
  'listening-comprehension': 'Listening Comprehension',
  'answer-questions-audio': 'Answer Questions (Audio)',
  'true-false-audio': 'True/False (Audio)',
  'multiple-choice-audio': 'Multiple Choice (Audio)',
  'fill-in-blanks-audio': 'Fill in the Blanks (Audio)',
};

interface AddExerciseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worksheetId: string;
  worksheetFormData: any;
  currentExerciseCount: number;
  editableWorksheet: any;
  setEditableWorksheet: (worksheet: any) => void;
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

  const maxExercises = 12;
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Build prompt for single exercise generation
      const prompt = `Generate a single ${selectedType} exercise for the topic: ${worksheetFormData?.lessonTopic || 'General English'}. 
Level: ${worksheetFormData?.englishLevel || 'B1'}. 
${worksheetFormData?.teachingPreferences ? `Grammar focus: ${worksheetFormData.teachingPreferences}.` : ''}
${additionalInstructions ? `Additional instructions: ${additionalInstructions}` : ''}`;

      const response = await supabase.functions.invoke('generateWorksheet', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: {
          prompt,
          formData: {
            ...worksheetFormData,
            targetExerciseTypes: [selectedType],
            exerciseCountPerType: 1,
          },
          userId,
          isBatchGeneration: true,
        },
      });

      if (response.error) throw new Error(response.error.message || 'Generation failed');

      const generatedData = response.data;
      
      // Extract the first exercise from generated data
      const newExercise = generatedData?.exercises?.[0];
      if (!newExercise) throw new Error("No exercise was generated");

      // Update the exercise number
      const exerciseNumber = currentExerciseCount + 1;
      newExercise.title = `Exercise ${exerciseNumber}: ${newExercise.title?.replace(/^Exercise\s+\d+:\s*/i, '') || selectedType}`;

      // Add to worksheet - insert before vocabulary_sheet (at the end of exercises array)
      const updatedExercises = [...(editableWorksheet.exercises || []), newExercise];
      const updatedWorksheet = { ...editableWorksheet, exercises: updatedExercises };

      // Save to database
      const aiResponse = JSON.parse(JSON.stringify(updatedWorksheet));
      const { error: updateError } = await supabase
        .from('worksheets')
        .update({ ai_response: aiResponse })
        .eq('id', worksheetId)
        .eq('teacher_id', userId);

      if (updateError) throw updateError;

      // Update local state
      setEditableWorksheet(updatedWorksheet);

      toast.success(`Exercise "${availableTypes[selectedType]}" added successfully!`);
      handleClose();
    } catch (error: any) {
      console.error('[AddExerciseModal] Error:', error);
      toast.error(error.message || "Failed to generate exercise");
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
                onChange={(e) => setAdditionalInstructions(e.target.value)}
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
