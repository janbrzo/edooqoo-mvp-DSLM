/**
 * DrawingToolbar - Pasek narzędzi rysowania (wzór: Windows Snipping Tool)
 * 
 * Narzędzia: Select Worksheet | Marker ▼ | Highlighter ▼ | Arrow ▼ | Eraser
 * Akcje: Undo | Redo | Clear All
 * 
 * NAPRAWIONE v5.0:
 * - Każde narzędzie ma osobne ustawienia (kolor, grubość)
 * - Zmiana w jednym narzędziu NIE wpływa na inne
 */

console.log('🎨 DrawingToolbar v5.0 loaded');

import { 
  Undo2,
  Redo2,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { DrawingToolbarProps, DrawingTool, DRAWING_TOOLS, ToolSettingsMap, DEFAULT_DRAWING_COLOR, DEFAULT_STROKE_WIDTH, HIGHLIGHTER_COLORS } from '@/types/drawing';
import { DrawingToolButton } from './DrawingToolButton';

// Domyślne ustawienia dla każdego narzędzia (fallback)
const DEFAULT_TOOL_SETTINGS: ToolSettingsMap = {
  marker: { color: DEFAULT_DRAWING_COLOR, strokeWidth: { name: '4', value: 4 } },
  highlighter: { color: HIGHLIGHTER_COLORS[0], strokeWidth: { name: '6', value: 6 } },
  arrow: { color: DEFAULT_DRAWING_COLOR, strokeWidth: { name: '3', value: 3 } },
};

export const DrawingToolbar = ({
  state,
  toolSettings,
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onUndo,
  onRedo,
  onClearAll,
}: DrawingToolbarProps) => {
  const { activeTool, activeColor, strokeWidth, canUndo, canRedo, isSaving } = state;
  
  // Użyj przekazanych toolSettings lub fallback
  const settings = toolSettings || DEFAULT_TOOL_SETTINGS;

  console.log('🎨 [DrawingToolbar] Render:', { activeTool, canUndo, canRedo, isSaving });

  // Pobierz ustawienia dla konkretnego narzędzia
  const getToolColor = (toolId: DrawingTool) => {
    if (toolId === 'marker' || toolId === 'highlighter' || toolId === 'arrow') {
      return settings[toolId].color;
    }
    return activeColor;
  };

  const getToolStrokeWidth = (toolId: DrawingTool) => {
    if (toolId === 'marker' || toolId === 'highlighter' || toolId === 'arrow') {
      return settings[toolId].strokeWidth;
    }
    return strokeWidth;
  };

  return (
    <>
      {/* NAPRAWKA v2: Status "Saving..." przeniesiony poza toolbar - stała pozycja NAD toolbarem */}
      {isSaving && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[101] bg-amber-100 text-amber-800 px-3 py-1 rounded-full shadow text-xs font-medium animate-pulse">
          Saving...
        </div>
      )}

      {/* Główny toolbar */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-background/95 backdrop-blur-sm border rounded-xl shadow-lg p-2 flex items-center gap-1 flex-wrap max-w-[95vw]">
        {/* Narzędzia rysowania */}
        {DRAWING_TOOLS.map((tool, index) => (
          <div key={tool.id} className="flex items-center">
            {/* Separator po Select Worksheet i przed Eraser */}
            {(index === 1 || tool.id === 'eraser') && (
              <Separator orientation="vertical" className="h-8 mx-1" />
            )}
            
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <DrawingToolButton
                    tool={tool.id}
                    label={tool.label}
                    isActive={activeTool === tool.id}
                    currentColor={getToolColor(tool.id)}
                    currentStrokeWidth={getToolStrokeWidth(tool.id)}
                    onToolSelect={() => onToolChange(tool.id)}
                    onColorChange={onColorChange}
                    onStrokeWidthChange={onStrokeWidthChange}
                    hasColorPicker={tool.hasColorPicker}
                    hasStrokeWidth={tool.hasStrokeWidth}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tool.label} {tool.shortcut && <span className="text-muted-foreground">({tool.shortcut})</span>}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ))}

        {/* TYMCZASOWO UKRYTE: Undo/Redo - do poprawy później */}
        {/* 
        <Separator orientation="vertical" className="h-8 mx-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="w-9 h-9 p-0" onClick={onUndo} disabled={!canUndo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Undo (Ctrl+Z)</p></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="w-9 h-9 p-0" onClick={onRedo} disabled={!canRedo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Redo (Ctrl+Y)</p></TooltipContent>
        </Tooltip>
        */}

        <Separator orientation="vertical" className="h-8 mx-1" />

        {/* Clear All z potwierdzeniem */}
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-9 h-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear All</p>
            </TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear all drawings?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all drawings from the worksheet. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={onClearAll}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Clear All
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};

export default DrawingToolbar;
