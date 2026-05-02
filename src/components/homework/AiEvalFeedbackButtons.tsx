/**
 * AiEvalFeedbackButtons - Thumbs up/down for teacher feedback on AI evaluation
 * Only rendered in Live Session mode
 */
import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AiEvalFeedbackModal } from "./AiEvalFeedbackModal";

interface AiEvalFeedbackButtonsProps {
  worksheetId: string;
  exerciseIndex: number;
  questionIndex: number;
  exerciseType: string;
  qualityScore: number;
  teacherId: string;
}

export function AiEvalFeedbackButtons({
  worksheetId, exerciseIndex, questionIndex, exerciseType, qualityScore, teacherId
}: AiEvalFeedbackButtonsProps) {
  const [feedbackRowId, setFeedbackRowId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [thumbsUp, setThumbsUp] = useState(true);
  const [voted, setVoted] = useState<boolean | null>(null);

  const handleThumb = async (isUp: boolean) => {
    setThumbsUp(isUp);
    setVoted(isUp);
    
    try {
      const { data, error } = await supabase
        .from('teacher_ai_eval_feedback' as any)
        .insert({
          teacher_id: teacherId,
          worksheet_id: worksheetId,
          exercise_index: exerciseIndex,
          question_index: questionIndex,
          exercise_type: exerciseType,
          quality_score: qualityScore,
          thumbs_up: isUp
        } as any)
        .select('id')
        .single();
      
      if (error) throw error;
      setFeedbackRowId((data as any)?.id || null);
      setModalOpen(true);
    } catch (e) {
      console.error('[AiEvalFeedback] Error inserting:', e);
    }
  };

  return (
    <>
      <button
        onClick={() => handleThumb(true)}
        className={`p-0.5 rounded hover:bg-muted transition-colors ${voted === true ? 'text-green-600' : 'text-muted-foreground'}`}
        title="AI evaluation is correct"
        disabled={voted !== null}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => handleThumb(false)}
        className={`p-0.5 rounded hover:bg-muted transition-colors ${voted === false ? 'text-red-600' : 'text-muted-foreground'}`}
        title="AI evaluation needs improvement"
        disabled={voted !== null}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      <AiEvalFeedbackModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        feedbackRowId={feedbackRowId}
        thumbsUp={thumbsUp}
      />
    </>
  );
}
