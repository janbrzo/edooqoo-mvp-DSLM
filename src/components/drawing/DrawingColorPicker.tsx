/**
 * DrawingColorPicker - Wybór koloru do rysowania
 * 
 * Wyświetla siatkę 9 predefiniowanych kolorów.
 * Aktualnie wybrany kolor jest podświetlony.
 */

import { Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { DrawingColorPickerProps, DRAWING_COLORS, DrawingColor } from '@/types/drawing';
import { cn } from '@/lib/utils';

export const DrawingColorPicker = ({ 
  selectedColor, 
  onColorSelect 
}: DrawingColorPickerProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-10 h-10 p-1 border-2"
          style={{ borderColor: selectedColor.hex }}
        >
          <div 
            className="w-full h-full rounded-sm"
            style={{ backgroundColor: selectedColor.hex }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center">
        <div className="grid grid-cols-3 gap-1">
          {DRAWING_COLORS.map((color) => (
            <button
              key={color.name}
              onClick={() => onColorSelect(color)}
              className={cn(
                "w-8 h-8 rounded-md border-2 transition-all hover:scale-110 flex items-center justify-center",
                selectedColor.name === color.name 
                  ? "border-primary ring-2 ring-primary/50" 
                  : "border-transparent hover:border-muted-foreground/30"
              )}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            >
              {selectedColor.name === color.name && (
                <Check 
                  className={cn(
                    "h-4 w-4",
                    color.name === 'White' || color.name === 'Yellow' 
                      ? "text-black" 
                      : "text-white"
                  )} 
                />
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          {selectedColor.name}
        </p>
      </PopoverContent>
    </Popover>
  );
};

export default DrawingColorPicker;
