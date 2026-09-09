import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, ChevronDown, FileText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RecentWorksheetRow, type RecentWorksheet } from './RecentWorksheetRow';
import { AllStudentsInline } from './AllStudentsInline';
import type { NextUpStudent } from '@/hooks/useNextUpStudents';
import type { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'>;

const RECENT_OPEN_KEY = 'edooqoo.dashboard.recentOpen';
const STUDENTS_OPEN_KEY = 'edooqoo.dashboard.allStudentsOpen';

interface EverythingElseSectionProps {
  studentsCount: number;
  worksheetsCount: number;
  /** false in guided mode before the first worksheet */
  showWorksheets: boolean;
  recentWorksheets: RecentWorksheet[];
  students: Student[];
  nextLessonById?: Record<string, NextUpStudent['nextLesson']>;
  onRename: (worksheet: RecentWorksheet) => void;
  onRefetch: () => void;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* storage unavailable — ignore */
  }
}

/** v6.9.109 — zone C of the Today dashboard: quiet navigation + collapsed archive. */
export const EverythingElseSection: React.FC<EverythingElseSectionProps> = ({
  studentsCount,
  worksheetsCount,
  showWorksheets,
  recentWorksheets,
  students,
  nextLessonById,
  onRename,
  onRefetch,
  onDelete,
}) => {
  const [open, setOpen] = useState<boolean>(() => readFlag(RECENT_OPEN_KEY));
  const [studentsOpen, setStudentsOpen] = useState<boolean>(() => readFlag(STUDENTS_OPEN_KEY));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    writeFlag(RECENT_OPEN_KEY, next);
  };

  const handleStudentsOpenChange = (next: boolean) => {
    setStudentsOpen(next);
    writeFlag(STUDENTS_OPEN_KEY, next);
  };


  const tileClass =
    'flex items-center justify-between rounded-lg border border-border p-3 text-sm text-foreground hover:bg-muted/50';

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange} asChild>
    <section aria-labelledby="everything-else-heading" className="space-y-4">
      <h2 id="everything-else-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Everything else
      </h2>

      <nav aria-label="Deep views" className={cn('grid grid-cols-1 gap-3', showWorksheets ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        <div className={cn(tileClass, 'gap-2 p-0 hover:bg-transparent')}>
          <Link to="/students" className="flex flex-1 items-center gap-2 rounded-l-lg p-3 hover:bg-muted/50">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            All students ({studentsCount})
          </Link>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleStudentsOpenChange(!studentsOpen)}
            aria-expanded={studentsOpen}
            aria-label={studentsOpen ? 'Hide student list' : 'Show student list'}
            className="h-full self-stretch rounded-l-none rounded-r-lg border-l border-border bg-muted px-3 py-3 hover:bg-muted/80"
          >
            <ChevronDown
              className={cn('h-4 w-4 text-muted-foreground transition-transform', studentsOpen && 'rotate-180')}
              aria-hidden="true"
            />
          </Button>
        </div>
        {showWorksheets && (
          <div className={cn(tileClass, 'gap-2 p-0 hover:bg-transparent')}>
            <Link
              to="/worksheets"
              className="flex flex-1 items-center gap-2 rounded-l-lg p-3 hover:bg-muted/50"
              aria-label={`View all worksheets (${worksheetsCount})`}
            >
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Worksheets ({worksheetsCount})
            </Link>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-expanded={open}
                aria-label={open ? 'Hide recent worksheets' : 'Show recent worksheets'}
                className="h-full self-stretch rounded-l-none rounded-r-lg border-l border-border bg-muted px-3 py-3 hover:bg-muted/80"
              >
                <ChevronDown
                  className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')}
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        )}
        <Link to="/calendar" className={tileClass}>
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Calendar
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </Link>
      </nav>

      {studentsOpen && <AllStudentsInline students={students} nextLessonById={nextLessonById} />}


      {showWorksheets && recentWorksheets.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground">Recent worksheets ({recentWorksheets.length})</p>
          <CollapsibleContent>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {recentWorksheets.map((w) => (
                <RecentWorksheetRow
                  key={w.id}
                  worksheet={w}
                  students={students}
                  onRename={onRename}
                  onRefetch={onRefetch}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </CollapsibleContent>
        </div>
      )}
    </section>
    </Collapsible>
  );
};

export default EverythingElseSection;
