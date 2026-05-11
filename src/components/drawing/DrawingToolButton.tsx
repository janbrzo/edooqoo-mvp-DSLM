/**
 * DrawingToolButton - Przycisk narzędzia z popover (wzór: Windows Snipping Tool)
 * 
 * NAPRAWIONE v3.0:
 * - Pierwszy klik = wybiera narzędzie (NIE otwiera popover)
 * - Strzałka pojawia się TYLKO gdy narzędzie jest aktywne
 * - Drugi klik na aktywne narzędzie = otwiera popover z kolorami i grubością
 * - Po wyborze koloru lub grubości popover się zamyka
 * - Kliknięcie poza popover NIE rysuje, tylko zamyka popover
 * - Slider bez "px" - wyświetla tylko liczbę
 * - Usunięte onOpenChange z Popover - pełna kontrola ręczna
 */

console.log('🎨 DrawingToolButton v3.0 loaded');

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import { ChevronDown, Pen, Highlighter, MoveUpRight, Eraser, MousePointer2 } from 'lucide-react';
import { 
  DrawingTool, 
  DrawingColor, 
  StrokeWidth,
  MARKER_COLORS,
  HIGHLIGHTER_COLORS,
} from '@/types/drawing';
import { cn } from '@/lib/utils';

interface DrawingToolButtonProps {
  tool: DrawingTool;
  label: string;
  isActive: boolean;
  currentColor: DrawingColor;
  currentStrokeWidth: StrokeWidth;
  onToolSelect: () => void;
  onColorChange: (color: DrawingColor) => void;
  onStrokeWidthChange: (width: StrokeWidth) => void;
  hasColorPicker?: boolean;
  hasStrokeWidth?: boolean;
}

const iconMap: Record<DrawingTool, React.ComponentType<{ className?: string }>> = {
  'select-worksheet': MousePointer2,
  'marker': Pen,
  'highlighter': Highlighter,
  'arrow': MoveUpRight,
  'eraser': Eraser,
};

export const DrawingToolButton = ({
  tool,
  label,
  isActive,
  currentColor,
  currentStrokeWidth,
  onToolSelect,
  onColorChange,
  onStrokeWidthChange,
  hasColorPicker = false,
  hasStrokeWidth = false,
}: DrawingToolButtonProps) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const Icon = iconMap[tool];
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Wybierz odpowiednie kolory dla narzędzia
  const availableColors = tool === 'highlighter' ? HIGHLIGHTER_COLORS : MARKER_COLORS;
  
  // NAPRAWKA v3: Zamknij popover gdy narzędzie przestaje być aktywne
  useEffect(() => {
    if (!isActive && isPopoverOpen) {
      console.log('🎨 [ToolButton] Closing popover - tool deactivated');
      setIsPopoverOpen(false);
    }
  }, [isActive, isPopoverOpen]);

  // NAPRAWKA v3: Obsługa kliknięcia - rozdzielenie logiki
  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎨 [ToolButton] Click:', { tool, isActive, hasColorPicker, isPopoverOpen });
    
    if (!isActive) {
      // Pierwsze kliknięcie = wybierz narzędzie, NIE otwieraj popover
      console.log('🎨 [ToolButton] Selecting tool:', tool);
      onToolSelect();
      // Popover pozostaje zamknięty
    } else if (hasColorPicker || hasStrokeWidth) {
      // Drugie kliknięcie na aktywne narzędzie = toggle popover
      console.log('🎨 [ToolButton] Toggle popover:', !isPopoverOpen);
      setIsPopoverOpen(prev => !prev);
    }
  };

  // NAPRAWKA v3: Zamknij popover po wyborze koloru
  const handleColorSelect = (color: DrawingColor, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🎨 [ToolButton] Color selected:', color.name);
    onColorChange(color);
    setIsPopoverOpen(false);
  };

  // NAPRAWKA v3: Zamknij popover po wyborze grubości (onValueCommit)
  const handleStrokeWidthCommit = (value: number[]) => {
    console.log('🎨 [ToolButton] StrokeWidth committed:', value[0]);
    onStrokeWidthChange({ name: `${value[0]}`, value: value[0] });
    setIsPopoverOpen(false);
  };

  // Znajdź kolor do wyświetlenia w przycisku (dla wskaźnika koloru)
  const displayColor = tool === 'highlighter' 
    ? (HIGHLIGHTER_COLORS.find(c => c.name === currentColor.name) || HIGHLIGHTER_COLORS[0])
    : currentColor;

  // Czy pokazać strzałkę w dół (tylko gdy aktywne I ma popover)
  const showChevron = isActive && (hasColorPicker || hasStrokeWidth);

  return (
    <div className="relative">
      {/* Główny przycisk narzędzia */}
      <Button
        ref={buttonRef}
        variant={isActive ? "default" : "ghost"}
        size="sm"
        className={cn(
          "relative h-9 px-3 gap-1",
          isActive && "bg-primary text-primary-foreground"
        )}
        onClick={handleButtonClick}
      >
        <Icon className="h-4 w-4" />
        {/* Wskaźnik koloru pod ikoną (tylko dla narzędzi z kolorem) */}
        {hasColorPicker && (
          <div 
            className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 rounded-full"
            style={{ backgroundColor: displayColor.hex }}
          />
        )}
        {/* Strzałka w dół - tylko gdy aktywne i ma popover */}
        {showChevron && (
          <ChevronDown className="h-3 w-3 ml-0.5" />
        )}
      </Button>
      
      {/* NAPRAWKA v3: Popover bez onOpenChange - pełna kontrola ręczna */}
      {(hasColorPicker || hasStrokeWidth) && (
        <Popover open={isPopoverOpen} modal={false}>
          {/* Niewidoczny trigger - pozycjonujemy popover pod przyciskiem */}
          <PopoverTrigger asChild>
            <div className="absolute inset-0 pointer-events-none" />
          </PopoverTrigger>
          
          <PopoverContent 
            className="w-56 p-3" 
            align="start"
            sideOffset={5}
            onPointerDownOutside={(e) => {
              // NAPRAWKA v3: Zapobiegaj rysowaniu gdy klikamy poza popover
              e.preventDefault();
              console.log('🎨 [ToolButton] Closing popover - clicked outside');
              setIsPopoverOpen(false);
            }}
            onEscapeKeyDown={() => {
              console.log('🎨 [ToolButton] Closing popover - escape pressed');
              setIsPopoverOpen(false);
            }}
            onFocusOutside={(e) => {
              e.preventDefault();
            }}
            onInteractOutside={(e) => {
              e.preventDefault();
              setIsPopoverOpen(false);
            }}
          >
            {/* Siatka kolorów */}
            {hasColorPicker && (
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-2">Color</p>
                <div className="grid grid-cols-5 gap-1">
                  {availableColors.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      className={cn(
                        "w-8 h-8 rounded-md border-2 transition-all hover:scale-110",
                        currentColor.name === color.name 
                          ? "border-primary ring-2 ring-primary/30" 
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: color.hex }}
                      onClick={(e) => handleColorSelect(color, e)}
                      onMouseDown={(e) => e.stopPropagation()}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Slider grubości - zakres 1-16, bez "px" */}
            {hasStrokeWidth && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Stroke: {currentStrokeWidth.value}
                </p>
                <Slider
                  value={[currentStrokeWidth.value]}
                  min={1}
                  max={16}
                  step={1}
                  onValueChange={(value) => {
                    // Preview podczas przeciągania (nie zamyka popover)
                    onStrokeWidthChange({ name: `${value[0]}`, value: value[0] });
                  }}
                  onValueCommit={handleStrokeWidthCommit}
                  className="w-full"
                />
                {/* Preview line */}
                <div className="mt-2 flex items-center justify-center h-8 bg-muted/30 rounded">
                  <div 
                    className="rounded-full"
                    style={{ 
                      width: Math.min(currentStrokeWidth.value * 8, 100),
                      height: currentStrokeWidth.value,
                      backgroundColor: tool === 'highlighter' ? displayColor.hex : currentColor.hex
                    }}
                  />
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default DrawingToolButton;
