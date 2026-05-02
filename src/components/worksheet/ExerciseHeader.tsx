
import React from "react";
import { Eye, Database, Pencil, Star, User, Lightbulb, Clock, RefreshCw, ChevronUp, ChevronDown, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExerciseHeaderProps {
  icon: string;
  title: string;
  isEditing: boolean;
  time: number;
  onTitleChange: (value: string) => void;
  // Regeneration props
  canRegenerate?: boolean;
  isRegenerating?: boolean;
  onRegenerateClick?: () => void;
  // Exercise management props
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  // PROBLEM 5: Live Session Done button props
  viewMode?: "student" | "teacher" | "live-session";
  isMarkedDone?: boolean;
  onMarkDone?: () => void;
  // Exercise focus tag [V] or [G]
  exerciseFocus?: string;
}

const getIconComponent = (iconName: string) => {
  switch (iconName) {
    case "fa-book-open":
      return <Eye className="h-5 w-5" />;
    case "fa-link":
      return <Database className="h-5 w-5" />;
    case "fa-pencil-alt":
      return <Pencil className="h-5 w-5" />;
    case "fa-check-square":
      return <Star className="h-5 w-5" />;
    case "fa-comments":
      return <User className="h-5 w-5" />;
    case "fa-question-circle":
      return <Lightbulb className="h-5 w-5" />;
    case "warmup":
      return <User className="h-5 w-5" />;
    case "grammar":
      return <Eye className="h-5 w-5" />;
    default:
      return <Eye className="h-5 w-5" />;
  }
};

const ExerciseHeader: React.FC<ExerciseHeaderProps> = ({
  icon,
  title,
  isEditing,
  time,
  onTitleChange,
  canRegenerate = false,
  isRegenerating = false,
  onRegenerateClick,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onDelete,
  // PROBLEM 5: Live Session props
  viewMode,
  isMarkedDone = false,
  onMarkDone,
  exerciseFocus
}) => {
  // Build the focus tag [V] or [G] to insert into title
  const focusTag = exerciseFocus === 'vocabulary' ? '[V] ' : exerciseFocus === 'grammar' ? '[G] ' : '';
  
  // Insert focus tag after "Exercise N: " pattern
  const displayTitle = (() => {
    if (!focusTag) return title;
    const match = title.match(/^(Exercise\s+\d+:\s*)(.*)$/i);
    if (match) return `${match[1]}${focusTag}${match[2]}`;
    return `${focusTag}${title}`;
  })();

  return (
  <div className={cn(
    "bg-worksheet-purple text-white p-2 flex justify-between items-center exercise-header",
    // PROBLEM 5: Apply "done" styling when exercise is marked done in Live Session
    isMarkedDone && "bg-gray-400 opacity-80"
  )}>
    <div className="flex items-center">
      <div className={cn(
        "p-2 rounded-full mr-3",
        isMarkedDone ? "bg-white/30" : "bg-white/20"
      )}>
        {isMarkedDone ? <Check className="h-5 w-5" /> : getIconComponent(icon)}
      </div>
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-semibold">
          {isEditing ? (
            <input
              type="text"
              value={title}
              onChange={e => onTitleChange(e.target.value)}
              className="bg-transparent border-b border-white/30 text-white w-full p-1"
            />
          ) : displayTitle}
        </h3>
        {canRegenerate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRegenerateClick}
            disabled={isRegenerating}
            className="text-yellow-300 hover:bg-white/20 hover:text-yellow-200 h-8 px-2 gap-1 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`} />
            <span className="text-xs">Regenerate</span>
          </Button>
        )}
        {/* PROBLEM 5: Done button - visible only in Live Session mode with better visibility */}
        {viewMode === 'live-session' && onMarkDone && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onMarkDone}
            className={cn(
              "h-8 px-3 gap-1.5 transition-colors ml-2 font-medium rounded-md",
              isMarkedDone 
                ? "bg-green-600 text-white hover:bg-green-700 shadow-sm" 
                : "bg-white/20 text-white hover:bg-white/30 border border-white/30"
            )}
          >
            <Check className="h-4 w-4" />
            <span className="text-sm">{isMarkedDone ? 'Done' : 'Mark Done'}</span>
          </Button>
        )}
      </div>
    </div>
    <div className="flex items-center gap-1">
      {/* Exercise management buttons - always visible */}
      {onMoveUp && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="text-white hover:bg-white/20 h-8 w-8 p-0 transition-colors"
          title="Move up"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
      )}
      {onMoveDown && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="text-white hover:bg-white/20 h-8 w-8 p-0 transition-colors"
          title="Move down"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      )}
      {onDelete && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-red-300 hover:bg-red-500/20 hover:text-red-200 h-8 w-8 p-0 transition-colors"
          title="Delete exercise"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      <div className="flex items-center bg-white/20 px-3 py-1 rounded-md ml-2">
        <Clock className="h-4 w-4 mr-1" />
        <span className="text-sm">{time} min</span>
      </div>
    </div>
  </div>
  );
};

export default ExerciseHeader;
