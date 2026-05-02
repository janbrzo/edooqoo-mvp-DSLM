/**
 * AiEvalFeedbackModal - Modal for optional text feedback after thumbs up/down
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AiEvalFeedbackModalProps {
  open: boolean;
  onClose: () => void;
  feedbackRowId: string | null;
  thumbsUp: boolean;
}

export function AiEvalFeedbackModal({ open, onClose, feedbackRowId, thumbsUp }: AiEvalFeedbackModalProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!feedbackRowId || !text.trim()) return;
    setIsSending(true);
    try {
      await supabase
        .from('teacher_ai_eval_feedback' as any)
        .update({ feedback_text: text.trim() } as any)
        .eq('id', feedbackRowId);
    } catch (e) {
      console.error('[AiEvalFeedback] Error updating feedback:', e);
    }
    setIsSending(false);
    setText('');
    onClose();
  };

  const handleSkip = () => {
    setText('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{thumbsUp ? '👍' : '👎'} AI Evaluation Feedback</DialogTitle>
          <DialogDescription>
            Optional: tell us why you {thumbsUp ? 'agree' : 'disagree'} with this AI evaluation.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What could be improved? (optional)"
          className="min-h-[80px]"
        />
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" onClick={handleSkip}>Skip</Button>
          <Button onClick={handleSend} disabled={isSending || !text.trim()}>
            {isSending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
