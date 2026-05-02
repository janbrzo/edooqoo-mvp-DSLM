import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { useAllWorksheetHomework, HomeworkAssignment } from '@/hooks/useAllWorksheetHomework';
import { WorksheetHomeworkList } from '@/components/dashboard/WorksheetHomeworkList';

interface WorksheetHomeworkSectionProps {
  worksheetId: string;
  homework?: HomeworkAssignment[];
  compact?: boolean;
  displayMode?: 'full' | 'simplified';
}

export const WorksheetHomeworkSection = ({ 
  worksheetId, 
  homework: externalHomework, 
  compact = false,
  displayMode = 'full'
}: WorksheetHomeworkSectionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Fetch homework only if not provided from parent
  const { homeworkByWorksheet, loading } = useAllWorksheetHomework(
    externalHomework ? [] : [worksheetId]
  );
  
  const homework = externalHomework || homeworkByWorksheet[worksheetId] || [];
  const homeworkCount = homework.length;
  
  // Don't render if no homework
  if (homeworkCount === 0 && !loading) return null;
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-between hover:bg-accent/50",
            compact ? "text-xs py-1 h-auto" : ""
          )}
        >
          <span className="flex items-center gap-2">
            <BookOpen className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} text-primary`} />
            Homework Assignments ({homeworkCount})
          </span>
          {isOpen ? (
            <ChevronUp className={compact ? "h-3 w-3" : "h-4 w-4"} />
          ) : (
            <ChevronDown className={compact ? "h-3 w-3" : "h-4 w-4"} />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        {loading ? (
          <div className="text-center py-2 text-sm text-muted-foreground">
            Loading homework...
          </div>
        ) : (
          <WorksheetHomeworkList homework={homework} variant={displayMode} />
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

// Helper for className utility
const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(' ');
};
