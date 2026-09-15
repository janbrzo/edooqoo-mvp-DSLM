/**
 * LastLessonStrip — "what happened last time" (v6.9.111, M4 step 2).
 *
 * A single EntityRow so Prep, Timeline (M5) and Library (M6) share one row
 * anatomy. Purely presentational; the page owns navigation and reuse logic.
 */

import React from 'react';
import { FileText, MoreHorizontal } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EntityRow } from '@/components/student/EntityRow';
import { formatRelativeAge } from '@/lib/students/prepPlan';

export interface LastLessonWorksheet {
  id: string;
  title: string | null;
  created_at: string;
}

export interface LastLessonStripProps {
  worksheet: LastLessonWorksheet | null;
  isLoading: boolean;
  onReuse: (worksheetId: string) => void;
  onOpenLibrary: () => void;
  menu?: React.ReactNode;
}

export const LastLessonStrip: React.FC<LastLessonStripProps> = ({
  worksheet,
  isLoading,
  onReuse,
  onOpenLibrary,
  menu,
}) => {
  return (
    <Card data-testid="prep-last-lesson">
      <CardContent className="p-4 sm:p-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Last lesson
        </div>

        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-lg" />
        ) : worksheet ? (
          <EntityRow
            icon={FileText}
            title={worksheet.title?.trim() || 'Untitled worksheet'}
            href={`/worksheet/${worksheet.id}`}
            meta={formatRelativeAge(worksheet.created_at)}
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReuse(worksheet.id)}
              >
                Reuse
              </Button>
            }
            menu={
              menu ?? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="More actions">
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={onOpenLibrary}>
                      View all worksheets
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            }
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              No worksheet yet — the first one becomes this student's history.
            </p>
            <Button variant="outline" size="sm" onClick={onOpenLibrary}>
              View all worksheets
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LastLessonStrip;
