/**
 * DrawingToggleButton - Przycisk włączania/wyłączania trybu rysowania
 * 
 * Wyświetlany tylko dla nauczyciela w trybie Live Session.
 * Zastępuje przyciski Download w tym trybie.
 */

import { Brush, BrushIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DrawingToggleButtonProps } from '@/types/drawing';
import { cn } from '@/lib/utils';

export const DrawingToggleButton = ({ 
  isEnabled, 
  onToggle, 
  disabled = false 
}: DrawingToggleButtonProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isEnabled ? "default" : "outline"}
          size="sm"
          onClick={onToggle}
          disabled={disabled}
          className={cn(
            "gap-2 transition-all duration-200",
            isEnabled && "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
          )}
        >
          <Brush className="h-4 w-4" />
          <span className="hidden sm:inline">
            {isEnabled ? 'Drawing ON' : 'Draw'}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isEnabled ? 'Click to disable drawing mode' : 'Click to enable drawing mode'}</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default DrawingToggleButton;
