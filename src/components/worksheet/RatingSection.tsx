
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";

interface RatingSectionProps {
  rating: number;
  setRating: (rating: number) => void;
  feedback: string;
  setFeedback: (feedback: string) => void;
  handleSubmitRating: () => void;
}

const RatingSection: React.FC<RatingSectionProps> = ({
  rating,
  setRating,
  feedback,
  setFeedback,
  handleSubmitRating
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleRatingClick = (value: number) => {
    setRating(value);
    setIsDialogOpen(true);
  };

  return (
    <div data-no-pdf="true" className="p-6 rounded-lg mt-10 mb-6 text-center bg-white">
      <h3 className="text-indigo-800 mb-2 font-bold text-2xl">How would you rate this worksheet?</h3>
      <p className="text-blue-400 mb-4 text-base">Your feedback helps us improve our AI-generated worksheets</p>
      
      <div className="flex justify-center space-x-8 mb-2">
        <Toggle
          variant="feedback"
          size="icon"
          pressed={rating === 5}
          onPressedChange={() => handleRatingClick(5)}
          className="transition-transform transform hover:scale-110"
          aria-label="Thumbs up"
        >
          <ThumbsUp size={32} className={`${rating === 5 ? 'text-blue-500' : 'text-gray-300'}`} />
        </Toggle>
        
        <Toggle
          variant="feedback"
          size="icon"
          pressed={rating === 1}
          onPressedChange={() => handleRatingClick(1)}
          className="transition-transform transform hover:scale-110"
          aria-label="Thumbs down"
        >
          <ThumbsDown size={32} className={`${rating === 1 ? 'text-blue-500' : 'text-gray-300'}`} />
        </Toggle>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md" data-no-pdf="true">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold mb-1">
              Your feedback is important!
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex justify-center mt-3 mb-4">
            {rating === 5 ? (
              <ThumbsUp size={38} className="text-blue-500" />
            ) : (
              <ThumbsDown size={38} className="text-blue-500" />
            )}
          </div>
          
          <label className="block text-base font-semibold mb-1 mt-2" htmlFor="feedbackTextarea">
            What did you think about this worksheet? (optional)
          </label>
          <Textarea 
            id="feedbackTextarea" 
            value={feedback} 
            onChange={e => setFeedback(e.target.value)} 
            placeholder="Your feedback helps us improve our worksheet generator" 
            rows={4} 
            className="mb-3" 
          />
          
          <div className="flex justify-end space-x-2 mt-2">
            <DialogClose asChild>
              <Button size="sm" variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              size="sm" 
              variant="default" 
              onClick={handleSubmitRating} 
              className="bg-[#3d348b] text-white hover:bg-[#3d348b]/90"
            >
              Submit Feedback
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RatingSection;
