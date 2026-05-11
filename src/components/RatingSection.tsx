
import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RatingSectionProps {
  className?: string;
}

const RatingSection = ({ className }: RatingSectionProps) => {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    console.log({ rating, feedback });
    setSubmitted(true);
    setIsOpen(false);
  };

  const handleRatingClick = (selectedRating: number) => {
    setRating(selectedRating);
    setIsOpen(true);
  };

  return (
    <div className={`rating-section p-6 rounded-lg bg-blue-50 text-center ${className}`}>
      <h3 className="text-xl font-semibold text-indigo-800 mb-2">How would you rate this worksheet?</h3>
      <p className="text-blue-700 mb-4">Your feedback helps us improve our AI-generated worksheets</p>
      
      <div className="flex justify-center space-x-2 mb-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRatingClick(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="focus:outline-none transition-transform transform hover:scale-110"
            aria-label={`Rate ${star} stars`}
          >
            <Star
              size={32}
              className={`${
                (hover || rating) >= star 
                  ? 'text-yellow-400 fill-yellow-400' 
                  : 'text-gray-300'
              } transition-colors`}
            />
          </button>
        ))}
      </div>

      {submitted && (
        <p className="text-green-600 font-medium mt-2">Thank you for your feedback!</p>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-xl">Your feedback is important!</DialogTitle>
          </DialogHeader>
          
          <div className="flex justify-center space-x-2 my-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={32}
                className={`${
                  rating >= star 
                    ? 'text-yellow-400 fill-yellow-400' 
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                What did you think about this worksheet? (optional)
              </label>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Your feedback helps us improve our worksheet generator"
                rows={4}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleSubmit}>Submit Feedback</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RatingSection;
