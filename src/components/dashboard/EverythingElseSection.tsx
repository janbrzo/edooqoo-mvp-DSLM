import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Calendar, ChevronRight, FileText, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RecentWorksheetRow, type RecentWorksheet } from './RecentWorksheetRow';
import type { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'>;

const RECENT_OPEN_KEY = 'edooqoo.dashboard.recentOpen';

interface EverythingElseSectionProps {
  studentsCount: number;
  worksheetsCount: number;
  /** false in guided mode before the first worksheet */
  showWorksheets: boolean;
  recentWorksheets: RecentWorksheet[];
  students: Student[];
  onRename: (worksheet: RecentWorksheet) => void;
  onRefetch: () => void;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
}

function readRecentOpen(): boolean {
  try {
    return localStorage.getItem(RECENT_OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** v6.9.109 — zone C of the Today dashboard: quiet navigation + collapsed archive. */
export const EverythingElseSection: React.FC<EverythingElseSectionProps> = ({
  studentsCount,
  worksheetsCount,
  showWorksheets,
  recentWorksheets,
  students,
  onRename,
  onRefetch,
  onDelete,
}) => {
  const [open, setOpen] = useState<boolean>(readRecentOpen);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    try {
      localStorage.setItem(RECENT_OPEN_KEY, next ? '1' : '0');
    } catch {
      /* storage unavailable — ignore */
    }
  };

  const tileClass =
    'flex items-center justify-between rounded-lg border border-border p-3 text-sm text-foreground hover:bg-muted/50';

  return (
    <section aria-labelledby="everything-else-heading" className="space-y-4">
      <h2 id="everything-else-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Everything else
      </h2>

      <nav aria-label="Deep views" className={cn('grid grid-cols-1 gap-3', showWorksheets ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
        <Link to="/students" className={tileClass}>
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            All students ({studentsCount})
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </Link>
        {showWorksheets && (
          <Link to="/worksheets" className={tileClass}>
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Worksheets ({worksheetsCount})
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}
        <Link to="/calendar" className={tileClass}>
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Calendar
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </Link>
      </nav>

      {showWorksheets && recentWorksheets.length > 0 && (
        <Collapsible open={open} onOpenChange={handleOpenChange}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="px-0 text-sm text-muted-foreground hover:bg-transparent" aria-expanded={open}>
              <ChevronRight className={cn('mr-1 h-4 w-4 transition-transform', open && 'rotate-90')} aria-hidden="true" />
              Recent worksheets ({recentWorksheets.length})
            </Button>
          </CollapsibleTrigger>
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
        </Collapsible>
      )}
    </section>
  );
};

export default EverythingElseSection;
