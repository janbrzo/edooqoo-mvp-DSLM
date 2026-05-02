/**
 * DrawingStrokeWidth - Wybór grubości linii
 * 
 * Wyświetla 4 predefiniowane grubości.
 * Aktualnie wybrana jest podświetlona.
 */

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { DrawingStrokeWidthProps, STROKE_WIDTHS, StrokeWidth } from '@/types/drawing';
import { cn } from '@/lib/utils';

export const DrawingStrokeWidth = ({ 
  selectedWidth, 
  onWidthSelect 
}: DrawingStrokeWidthProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-10 h-10 p-1 flex items-center justify-center"
          title={`Stroke: ${selectedWidth.name}`}
        >
          <div 
            className="bg-foreground rounded-full"
            style={{ 
              width: `${Math.min(selectedWidth.value * 2, 24)}px`,
              height: `${Math.min(selectedWidth.value * 2, 24)}px`
            }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center">
        <div className="flex flex-col gap-1">
          {STROKE_WIDTHS.map((width) => (
            <button
              key={width.name}
              onClick={() => onWidthSelect(width)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-all",
                selectedWidth.name === width.name 
                  ? "bg-primary/10 text-primary" 
                  : "hover:bg-muted"
              )}
              title={width.name}
            >
              <div 
                className="bg-foreground rounded-full"
                style={{ 
                  width: `${width.value * 2}px`,
                  height: `${width.value * 2}px`
                }}
              />
              <span className="text-sm min-w-[80px]">{width.name}</span>
              <span className="text-xs text-muted-foreground">{width.value}px</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DrawingStrokeWidth;
