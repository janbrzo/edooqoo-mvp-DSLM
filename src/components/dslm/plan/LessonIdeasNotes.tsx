/**
 * LessonIdeasNotes — the teacher's own "Next Lesson Ideas" notes (captured
 * e.g. during a live session), shown next to the lesson queue they inform.
 * Collapsed by default; hidden when there are none.
 */
import React, { useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StudentKnowledgeEntryCard } from '@/components/student-knowledge/StudentKnowledgeEntryCard';
import { useStudentKnowledge } from '@/hooks/useStudentKnowledge';
import { cn } from '@/lib/utils';

interface LessonIdeasNotesProps {
  studentId: string;
  teacherId: string;
}

export const LessonIdeasNotes: React.FC<LessonIdeasNotesProps> = ({ studentId, teacherId }) => {
  const knowledge = useStudentKnowledge({ studentId, teacherId });
  const [open, setOpen] = useState(false);
  const ideas = knowledge.entries.filter((entry) => entry.category === 'Next Lesson Ideas');
  if (ideas.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="px-2 text-muted-foreground" aria-expanded={open}>
          <Lightbulb className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Your lesson ideas ({ideas.length})
          <ChevronDown className={cn('ml-1 h-3 w-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-1">
        <p className="px-2 text-xs text-muted-foreground">Notes you saved for the next lessons. New suggestions take them into account.</p>
        {ideas.map((entry) => (
          <StudentKnowledgeEntryCard
            key={entry.id}
            entry={entry}
            onView={() => {}}
            onEdit={() => {}}
            onDelete={knowledge.deleteEntry}
            onMarkOutdated={knowledge.markAsOutdated}
            onMarkCurrent={knowledge.markAsCurrent}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};
