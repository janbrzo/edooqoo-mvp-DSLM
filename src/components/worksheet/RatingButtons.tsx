
import React from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Toggle } from "@/components/ui/toggle";

interface RatingButtonsProps {
  selected: number | null;
  submitting: boolean;
  hovered: number | null;
  onRatingClick: (value: number) => void;
  setHovered: (value: number | null) => void;
}

const RatingButtons: React.FC<RatingButtonsProps> = ({
  selected,
  submitting,
  hovered,
  onRatingClick,
  setHovered,
}) => {
  return (
    <div className="flex justify-center space-x-8 mb-2">
      <Toggle
        variant="feedback"
        size="icon"
        pressed={selected === 5}
        onPressedChange={() => onRatingClick(5)}
        disabled={submitting}
        className="transition-transform transform hover:scale-110"
        aria-label="Thumbs up"
      >
        <ThumbsUp
          size={32}
          className={`${selected === 5 ? 'text-blue-500' : 'text-gray-300'} ${hovered === 5 ? 'text-blue-300' : ''}`}
          onMouseEnter={() => setHovered(5)}
          onMouseLeave={() => setHovered(null)}
        />
      </Toggle>

      <Toggle
        variant="feedback"
        size="icon"
        pressed={selected === 1}
        onPressedChange={() => onRatingClick(1)}
        disabled={submitting}
        className="transition-transform transform hover:scale-110"
        aria-label="Thumbs down"
      >
        <ThumbsDown
          size={32}
          className={`${selected === 1 ? 'text-blue-500' : 'text-gray-300'} ${hovered === 1 ? 'text-blue-300' : ''}`}
          onMouseEnter={() => setHovered(1)}
          onMouseLeave={() => setHovered(null)}
        />
      </Toggle>
    </div>
  );
};

export default RatingButtons;
