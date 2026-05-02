
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { submitFeedback, updateFeedback } from "@/services/worksheetService";

export const useWorksheetRating = (
  worksheetId?: string | null,
  onSubmitRating?: (rating: number, feedback: string) => void
) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [thanksOpen, setThanksOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentFeedbackId, setCurrentFeedbackId] = useState<string | null>(null);
  const { toast } = useToast();
  const { userId } = useAnonymousAuth();
  
  const handleRatingClick = async (value: number) => {
    setSelected(value);
    setIsDialogOpen(true);
    
    try {
      setSubmitting(true);
      
      if (userId) {
        const actualWorksheetId = worksheetId || 
          new URL(window.location.href).searchParams.get('worksheet_id') || 
          null;
            
        if (actualWorksheetId) {
          const result = await submitFeedback(actualWorksheetId, value, '', userId);
          
          if (result && Array.isArray(result) && result.length > 0 && result[0].id) {
            setCurrentFeedbackId(result[0].id);
          }
          
          toast({
            title: "Rating submitted!",
            description: "Thanks for your feedback. Add a comment for more details."
          });
          
          if (onSubmitRating) {
            onSubmitRating(value, '');
          }
        }
      }
    } catch (error) {
      console.error("Error submitting rating:", error);
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleSubmit = async () => {
    if (!selected || !userId) return;
    
    try {
      setSubmitting(true);
      
      let actualWorksheetId = worksheetId || null;
      
      if (!actualWorksheetId && window.location.href.includes('worksheet_id=')) {
        actualWorksheetId = new URL(window.location.href).searchParams.get('worksheet_id');
      }
      
      if (!actualWorksheetId) {
        const worksheetElements = document.querySelectorAll('[data-worksheet-id]');
        if (worksheetElements.length > 0) {
          actualWorksheetId = worksheetElements[0].getAttribute('data-worksheet-id');
        }
      }
      
      if (currentFeedbackId) {
        await updateFeedback(currentFeedbackId, feedback, userId);
      } else if (actualWorksheetId) {
        const result = await submitFeedback(actualWorksheetId, selected, feedback, userId);
        
        if (result && Array.isArray(result) && result.length > 0 && result[0].id) {
          setCurrentFeedbackId(result[0].id);
        }
      } else {
        const placeholderResult = await submitFeedback('unknown', selected, feedback, userId);
        if (placeholderResult && Array.isArray(placeholderResult) && placeholderResult.length > 0) {
          setCurrentFeedbackId(placeholderResult[0].id);
        }
      }
      
      setIsDialogOpen(false);
      setThanksOpen(true);
      setTimeout(() => setThanksOpen(false), 2500);
      
      toast({
        title: "Thank you for your feedback!",
        description: "Your rating and comments help us improve our service."
      });
      
      if (onSubmitRating) {
        onSubmitRating(selected, feedback);
      }
      
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Feedback submission failed",
        description: "We couldn't submit your feedback. Please try again later.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  return {
    hovered,
    setHovered,
    selected,
    isDialogOpen,
    setIsDialogOpen,
    feedback,
    setFeedback,
    thanksOpen,
    submitting,
    handleRatingClick,
    handleSubmit,
  };
};
