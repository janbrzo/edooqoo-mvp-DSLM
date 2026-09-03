import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { MediaBadges } from '@/components/worksheet/MediaBadges';
import { DuplicateWorksheetModal } from '@/components/DuplicateWorksheetModal';
import { hasImage, hasAudio } from '@/utils/worksheetUtils';
import { useDemoContext } from '@/contexts/DemoContext';
import { useStudentSelector } from '@/hooks/useStudentSelector';
import { useAuthUser } from '@/hooks/useAuthUser';
import type { Tables } from '@/integrations/supabase/types';

type Student = Tables<'students'>;

export interface RecentWorksheet {
  id: string;
  title: string;
  created_at: string;
  form_data: any;
  student_id?: string | null;
  share_token?: string | null;
}

interface RecentWorksheetRowProps {
  worksheet: RecentWorksheet;
  students: Student[];
  onRename: (worksheet: RecentWorksheet) => void;
  onRefetch: () => void;
  onDelete: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export function formatWorksheetTitle(worksheet: Pick<RecentWorksheet, 'title' | 'form_data'>): string {
  if (worksheet.title) return worksheet.title;
  if (worksheet.form_data?.lessonTopic) return worksheet.form_data.lessonTopic;
  return 'Untitled Worksheet';
}

/**
 * v6.9.109 — list-density worksheet row for the Today dashboard.
 * All five former inline actions collapse into one `…` menu.
 */
export const RecentWorksheetRow: React.FC<RecentWorksheetRowProps> = ({
  worksheet,
  students,
  onRename,
  onRefetch,
  onDelete,
}) => {
  const { isDemoMode, showDemoBlockedToast } = useDemoContext();
  const { data: user } = useAuthUser();
  const { updateWorksheetStudent } = useStudentSelector();
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const title = formatWorksheetTitle(worksheet);
  const studentName = worksheet.student_id ? students.find((s) => s.id === worksheet.student_id)?.name ?? null : null;

  const handleCopyShareLink = () => {
    if (worksheet.share_token) {
      navigator.clipboard.writeText(`${window.location.origin}/shared/${worksheet.share_token}`);
      toast.success('Shared worksheet link copied to clipboard');
    } else {
      toast.error('No share link. Generate one from the worksheet view first.');
    }
  };

  const handleAssign = async (studentId: string | null) => {
    if (studentId === (worksheet.student_id ?? null)) return;
    if (!user?.id) return;
    const newName = studentId ? students.find((s) => s.id === studentId)?.name : undefined;
    const ok = await updateWorksheetStudent(worksheet.id, studentId, user.id, title, newName);
    if (ok) onRefetch();
  };

  const handleDelete = async () => {
    if (isDemoMode) {
      showDemoBlockedToast('Deleting worksheets');
      return;
    }
    setIsDeleting(true);
    try {
      const result = await onDelete(worksheet.id);
      if (result.success) {
        toast.success('Worksheet deleted');
        setDeleteOpen(false);
        setConfirmText('');
      } else {
        toast.error(result.error || 'Failed to delete worksheet');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <Link to={`/worksheet/${worksheet.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline">
        {title}
      </Link>
      <Badge variant="outline" className="hidden shrink-0 text-xs sm:inline-flex">
        {studentName ?? 'Unassigned'}
      </Badge>
      <MediaBadges hasImage={hasImage(worksheet)} hasAudio={hasAudio(worksheet)} size="sm" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${title}`}
            className="h-8 w-8 min-h-11 min-w-11 shrink-0 sm:min-h-8 sm:min-w-8"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => onRename(worksheet)}>Rename</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Assign to student</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
              <DropdownMenuItem onSelect={() => handleAssign(null)} disabled={!worksheet.student_id}>
                Unassigned
              </DropdownMenuItem>
              {students.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  onSelect={() => handleAssign(s.id)}
                  disabled={s.id === worksheet.student_id}
                >
                  {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            onSelect={() => {
              if (isDemoMode) {
                showDemoBlockedToast('Duplicating worksheets');
                return;
              }
              setDuplicateOpen(true);
            }}
          >
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleCopyShareLink}>Copy share link</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => {
              if (isDemoMode) {
                showDemoBlockedToast('Deleting worksheets');
                return;
              }
              setDeleteOpen(true);
            }}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DuplicateWorksheetModal
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        worksheetId={worksheet.id}
        worksheetTitle={title}
        onSuccess={onRefetch}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setConfirmText('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Worksheet</AlertDialogTitle>
            <AlertDialogDescription>
              Type the worksheet name to confirm deletion. This action can be undone later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">Worksheet name:</p>
            <code className="block rounded bg-muted p-2 text-sm break-all">{title}</code>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type worksheet name here"
              aria-label="Type worksheet name to confirm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting || confirmText !== title}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
};

export default RecentWorksheetRow;
