import { StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StudentKnowledgeToggleButtonProps {
  count: number;
  isOpen: boolean;
  onClick: () => void;
}

// PROBLEM 10: Position adjusted to top-[calc(50%+105px)] - below Add Note FAB
export const StudentKnowledgeToggleButton = ({
  count,
  isOpen,
  onClick,
}: StudentKnowledgeToggleButtonProps) => {
  const [showLabel, setShowLabel] = useState(true);

  useEffect(() => {
    // Hide after 10 seconds
    const hideTimer = setTimeout(() => setShowLabel(false), 10000);
    return () => clearTimeout(hideTimer);
  }, []);

  if (count === 0) return null;

  const labelText = isOpen ? 'Hide Recent Notes' : 'Show Recent Notes';

  return (
    <div className="fixed top-[calc(50%+105px)] right-6 z-40 flex items-center gap-2 pointer-events-none">
      {/* Animated label */}
      <div 
        className={`bg-amber-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg transition-all duration-300 whitespace-nowrap ${
          showLabel ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
        }`}
      >
        {labelText}
      </div>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative pointer-events-auto">
              <Button
                onClick={onClick}
                size="icon"
                className="p-3 rounded-full shadow-lg bg-amber-500 text-white opacity-80 hover:opacity-100 transition-opacity"
              >
                <StickyNote className="h-5 w-5" />
              </Button>
              {count > 0 && (
                <Badge 
                  variant="secondary" 
                  className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs bg-red-500 text-white border-2 border-background shadow-md z-10"
                >
                  {count > 9 ? '9+' : count}
                </Badge>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-amber-500 text-white border-amber-500">
            <p>{labelText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};