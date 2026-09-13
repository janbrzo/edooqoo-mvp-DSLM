/**
 * StudentSettingsMenu — the single settings entry point for a student
 * (v6.9.111, M3.2).
 *
 * Wraps existing behaviour rather than reimplementing it:
 * - Edit details reuses `StudentEditDialog` (name, level, goal, email, hub).
 * - Meeting link reuses `MeetingLinkField` inside a controlled dialog.
 * - Delete reuses the shared type-to-confirm dialog.
 *
 * Every mutating entry passes through `useDemoGuard`, so demo mode shows the
 * standard blocked toast and never opens a mutation form.
 */

import React, { useState } from 'react';
import { MoreHorizontal, Pencil, Video, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmTypeToDeleteDialog } from '@/components/dslm/ConfirmTypeToDeleteDialog';
import { MeetingLinkField } from '@/components/student/MeetingLinkField';
import { useDemoGuard } from '@/hooks/useDemoGuard';
import type { Tables } from '@/integrations/supabase/types';

export interface StudentSettingsMenuProps {
  student: Tables<'students'>;
  teacherId: string;
  gcalEnabled: boolean;
  /** Opens the existing `StudentEditDialog`, owned by `StudentPage`. */
  onEdit: () => void;
  /** Resolves only on a successful delete; navigation stays with `StudentPage`. */
  onDelete: () => Promise<void>;
}

export const StudentSettingsMenu: React.FC<StudentSettingsMenuProps> = ({
  student,
  teacherId,
  gcalEnabled,
  onEdit,
  onDelete,
}) => {
  const { guardAction } = useDemoGuard();
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>More actions</TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => guardAction('edit this student', onEdit)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit student details
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => guardAction('change the meeting link', () => setMeetingOpen(true))}
          >
            <Video className="mr-2 h-4 w-4" />
            Meeting link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => guardAction('delete this student', () => setDeleteOpen(true))}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete student
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={meetingOpen} onOpenChange={setMeetingOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Meeting link</DialogTitle>
            <DialogDescription>
              The room {student.name} joins for every lesson.
            </DialogDescription>
          </DialogHeader>
          {meetingOpen && (
            <MeetingLinkField
              studentId={student.id}
              teacherId={teacherId}
              hasGcal={gcalEnabled}
            />
          )}
        </DialogContent>
      </Dialog>

      <ConfirmTypeToDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        label={student.name}
        expectedText={student.name}
        description="This removes the student together with their worksheets, notes and learning model. This action cannot be undone."
        onConfirm={onDelete}
      />
    </>
  );
};

export default StudentSettingsMenu;
