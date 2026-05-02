import { Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StudentKnowledgeLessonIdeasButtonProps {
  onClick: () => void;
}

// Add Lesson Idea button - shows animated label immediately for 10 seconds
export const StudentKnowledgeLessonIdeasButton = ({ onClick }: StudentKnowledgeLessonIdeasButtonProps) => {
  const [showLabel, setShowLabel] = useState(true); // Show immediately

  useEffect(() => {
    // Hide after 10 seconds
    const hideTimer = setTimeout(() => setShowLabel(false), 10000);
    return () => clearTimeout(hideTimer);
  }, []);

  return (
    <div className="fixed top-[calc(50%+55px)] right-6 z-[100] flex items-center gap-2 pointer-events-none">
      {/* Animated label */}
      <div 
        className={`bg-yellow-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg transition-all duration-300 whitespace-nowrap ${
          showLabel ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
        }`}
      >
        Add Lesson Idea (I)
      </div>
      
      {/* Button with Tooltip */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onClick}
              size="icon"
              className="p-3 rounded-full shadow-lg bg-yellow-500 text-white opacity-80 hover:opacity-100 transition-opacity pointer-events-auto"
            >
              <Lightbulb className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-yellow-500 text-white border-yellow-500">
            <p>Add Lesson Idea (I)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};