
import React from "react";
import { useWorksheetRating } from "@/hooks/useWorksheetRating";
import RatingButtons from "@/components/worksheet/RatingButtons";
import FeedbackDialog from "@/components/worksheet/FeedbackDialog";

interface WorksheetRatingProps {
  onSubmitRating?: (rating: number, feedback: string) => void;
  worksheetId?: string | null;
}

/**
 * A modern-looking worksheet rating section with thumbs up/down rating and feedback modal.
 * Should not display on PDF.
 */
const WorksheetRating: React.FC<WorksheetRatingProps> = ({ onSubmitRating, worksheetId }) => {
  const {
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
  } = useWorksheetRating(worksheetId, onSubmitRating);

  return (
    <div data-no-pdf="true">
      <div className="p-6 rounded-lg mt-10 mb-6 text-center bg-white">
        <h3 className="text-indigo-800 mb-2 font-bold text-2xl">How would you rate this worksheet?</h3>
        <p className="text-blue-400 mb-4 text-base">Your feedback helps us improve our AI-generated worksheets</p>
        
        <RatingButtons
          selected={selected}
          submitting={submitting}
          hovered={hovered}
          setHovered={setHovered}
          onRatingClick={handleRatingClick}
        />
        
        {thanksOpen && (
          <p className="text-green-500 font-medium animate-fade-in">
            Thank you for your feedback!
          </p>
        )}
      </div>
      
      <FeedbackDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selected={selected}
        feedback={feedback}
        setFeedback={setFeedback}
        submitting={submitting}
        handleSubmit={handleSubmit}
      />
    </div>
  );
};

export default WorksheetRating;
