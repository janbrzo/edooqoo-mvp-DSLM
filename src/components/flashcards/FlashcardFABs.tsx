import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, TextSelect } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SelectWordFABProps {
  onClick: () => void;
}

// Select Word FAB - shows animated label immediately for 10 seconds
export const SelectWordFAB = ({ onClick }: SelectWordFABProps) => {
  const [showLabel, setShowLabel] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => setShowLabel(false), 10000);
    return () => clearTimeout(hideTimer);
  }, []);

  return (
    <div className="fixed top-[calc(50%-90px)] right-6 z-[100] flex items-center gap-2 pointer-events-none">
      <div 
        className={`bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg transition-all duration-300 whitespace-nowrap ${
          showLabel ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
        }`}
      >
        Select Word to Add (S)
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onClick}
              size="icon"
              className="p-3 rounded-full shadow-lg bg-green-500 hover:bg-green-600 text-white pointer-events-auto"
            >
              <TextSelect className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-green-500 text-white border-green-500">
            <p>Select Word to Add (S)</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

interface QuickAddWordFABProps {
  onClick: () => void;
  flashcardSetsCount?: number;
}

// Quick Add Word FAB - shows animated label immediately for 10 seconds
export const QuickAddWordFAB = ({ onClick, flashcardSetsCount = 0 }: QuickAddWordFABProps) => {
  const [showLabel, setShowLabel] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => setShowLabel(false), 10000);
    return () => clearTimeout(hideTimer);
  }, []);

  return (
    <div className="fixed top-[calc(50%-45px)] right-6 z-[100] flex items-center gap-2 pointer-events-none">
      <div 
        className={`bg-green-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg transition-all duration-300 whitespace-nowrap ${
          showLabel ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
        }`}
      >
        Quick Add Word to Flashcards (F)
      </div>
      <div className="relative pointer-events-auto">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={onClick}
                size="icon"
                className="p-3 rounded-full shadow-lg bg-green-500 hover:bg-green-600 text-white"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-green-500 text-white border-green-500">
              <p>Quick Add Word to Flashcards (F)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {flashcardSetsCount > 0 && (
          <Badge 
            variant="secondary" 
            className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-xs bg-green-600 text-white border-2 border-background shadow-md z-10"
          >
            {flashcardSetsCount > 9 ? '9+' : flashcardSetsCount}
          </Badge>
        )}
      </div>
    </div>
  );
};