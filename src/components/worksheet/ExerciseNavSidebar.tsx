import React, { useState } from 'react';
import { Menu, Clock, Eye, EyeOff, BookOpen } from 'lucide-react';
import { getIconComponent } from '@/utils/iconUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Exercise {
  title: string;
  icon: string;
  estimated_time?: string;
}

interface ExerciseNavSidebarProps {
  exercises: Exercise[];
  activeExercise: number | null;
  collapsedExercises: Map<number, boolean>;
  onScrollToExercise: (index: number) => void;
  onToggleExercise: (index: number) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  isAllCollapsed: boolean;
  isAllExpanded: boolean;
  isOpen?: boolean;
  setIsOpen?: (open: boolean) => void;
  hasGrammar?: boolean;
  hasVocabulary?: boolean;
  isGrammarActive?: boolean;
  isVocabularyActive?: boolean;
  hideCollapseControls?: boolean;
}

const ExerciseNavContent: React.FC<ExerciseNavSidebarProps> = ({
  exercises,
  activeExercise,
  collapsedExercises,
  onScrollToExercise,
  onToggleExercise,
  onCollapseAll,
  onExpandAll,
  isAllCollapsed,
  isAllExpanded,
  hideCollapseControls = false
}) => {
  return (
    <div className="h-full flex flex-col p-4">
      <div className="mb-4">
        <h3 className="text-sm font-medium text-foreground mb-2">
          Exercise Navigation
        </h3>
        
        {/* Control buttons */}
        {!hideCollapseControls && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={isAllExpanded ? onCollapseAll : onExpandAll}
            className="flex-1 h-8 text-xs"
          >
            {isAllExpanded ? (
              <>
                <EyeOff className="h-3 w-3 mr-1" />
                Collapse All
              </>
            ) : (
              <>
                <Eye className="h-3 w-3 mr-1" />
                Expand All
              </>
            )}
          </Button>

          {/* Grammar section scroll button */}
          {exercises.some(ex => ex.title.toLowerCase().includes('grammar')) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const grammarSection = document.querySelector('#grammar-rules-section, [data-section="grammar"]');
                if (grammarSection) {
                  grammarSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="flex items-center gap-2 text-xs h-8"
            >
              <BookOpen className="h-3 w-3" />
              Grammar
            </Button>
          )}
        </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-2">
          {exercises.map((exercise, index) => {
            const isActive = activeExercise === index;
            
            return (
              <Button
                key={index}
                variant={isActive ? "secondary" : "ghost"}
                onClick={() => onScrollToExercise(index)}
                className="w-full justify-start p-2 h-auto"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {getIconComponent(exercise.icon)}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm truncate">
                      {exercise.title || `Exercise ${index + 1}`}
                    </p>
                    {exercise.estimated_time && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{exercise.estimated_time}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Floating Exercise Buttons Component for desktop
const FloatingExerciseButtons: React.FC<{
  exercises: Exercise[];
  activeExercise: number | null;
  onScrollToExercise: (index: number) => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  isAllExpanded: boolean;
  hasGrammar?: boolean;
  hasVocabulary?: boolean;
  isGrammarActive?: boolean;
  isVocabularyActive?: boolean;
  hideCollapseControls?: boolean;
}> = ({ exercises, activeExercise, onScrollToExercise, onCollapseAll, onExpandAll, isAllExpanded, hasGrammar, hasVocabulary, isGrammarActive, isVocabularyActive, hideCollapseControls = false }) => {
  
  const handleGrammarScroll = () => {
    const grammarSection = document.querySelector('#grammar-rules-section, [data-section="grammar"]');
    if (grammarSection) {
      grammarSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleVocabularyScroll = () => {
    const vocabSection = document.querySelector('#vocabulary-sheet-section, [data-section="vocabulary"]');
    if (vocabSection) {
      vocabSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="fixed left-4 top-20 z-40 flex flex-col gap-1">
      {/* Eye button for expand/collapse all */}
      {!hideCollapseControls && (
      <Button
        variant="outline"
        size="sm"
        onClick={isAllExpanded ? onCollapseAll : onExpandAll}
        className="w-10 h-10 p-0 shadow-lg bg-background/95 backdrop-blur-sm"
        title={isAllExpanded ? "Collapse All" : "Expand All"}
      >
        {isAllExpanded ? (
          <EyeOff className="h-4 w-4" />
        ) : (
          <Eye className="h-4 w-4" />
        )}
      </Button>
      )}

      {/* Grammar button - conditionally shown */}
      {hasGrammar && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleGrammarScroll}
          className={cn(
            "w-10 h-10 p-0 shadow-lg bg-background/95 backdrop-blur-sm",
            isGrammarActive && "bg-primary text-primary-foreground border-primary"
          )}
          title="Scroll to Grammar"
        >
          <span className="font-bold text-sm">G</span>
        </Button>
      )}

      {/* Numbered exercise buttons */}
      {exercises.map((exercise, index) => {
        const isActive = activeExercise === index;
        
        return (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onScrollToExercise(index)}
            className={cn(
              "w-10 h-10 p-0 shadow-lg bg-background/95 backdrop-blur-sm",
              isActive && "bg-primary text-primary-foreground border-primary"
            )}
            title={`Scroll to ${exercise.title || `Exercise ${index + 1}`}`}
          >
            <span className="font-bold text-sm">{index + 1}</span>
          </Button>
        );
      })}

      {/* Vocabulary button - conditionally shown */}
      {hasVocabulary && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleVocabularyScroll}
          className={cn(
            "w-10 h-10 p-0 shadow-lg bg-background/95 backdrop-blur-sm",
            isVocabularyActive && "bg-primary text-primary-foreground border-primary"
          )}
          title="Scroll to Vocabulary"
        >
          <span className="font-bold text-sm">V</span>
        </Button>
      )}
    </div>
  );
};

export const ExerciseNavSidebar: React.FC<ExerciseNavSidebarProps> = (props) => {
  const isMobile = useIsMobile();
  const [localIsOpen, setLocalIsOpen] = useState(false);
  
  // Use controlled state if provided, otherwise use local state
  const isOpen = props.isOpen !== undefined ? props.isOpen : localIsOpen;
  const setIsOpen = props.setIsOpen || setLocalIsOpen;

  // Close sidebar when clicking outside (desktop only)
  React.useEffect(() => {
    if (!isMobile && isOpen) {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Element;
        if (target && !target.closest('.nav-sidebar') && !target.closest('.nav-menu-button')) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, isMobile, setIsOpen]);


  if (isMobile) {
    // Mobile: Use Sheet/Drawer only
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="fixed top-4 left-4 z-50 shadow-lg"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-4 pb-0">
            <SheetTitle>Exercise Navigation</SheetTitle>
          </SheetHeader>
          <ExerciseNavContent {...props} />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Use floating div with manual state and floating buttons
  return (
    <>
      {/* Floating trigger button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 shadow-lg bg-background/95 backdrop-blur-sm nav-menu-button"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Floating exercise buttons */}
      <FloatingExerciseButtons
        exercises={props.exercises}
        activeExercise={props.activeExercise}
        onScrollToExercise={props.onScrollToExercise}
        onCollapseAll={props.onCollapseAll}
        onExpandAll={props.onExpandAll}
        isAllExpanded={props.isAllExpanded}
        hasGrammar={props.hasGrammar}
        hasVocabulary={props.hasVocabulary}
        isGrammarActive={props.isGrammarActive}
        isVocabularyActive={props.isVocabularyActive}
        hideCollapseControls={props.hideCollapseControls}
      />

      {/* Floating sidebar */}
      {isOpen && (
        <div className="fixed left-4 top-16 h-[calc(100vh-5rem)] w-80 z-40 shadow-lg border bg-background/95 backdrop-blur-sm rounded-lg nav-sidebar">
          <ExerciseNavContent {...props} />
        </div>
      )}
    </>
  );
};