/**
 * SuggestionActionsMenu: the single `…` menu for a lesson suggestion.
 * Every action the old cards exposed as icons lives here; destructive
 * actions only ever appear inside this menu.
 */
import React from 'react';
import { CheckCircle2, ClipboardCopy, MessageSquarePlus, MoreHorizontal, Pencil, Trash2, Undo2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SuggestionActionsMenuProps {
  topic: string;
  generating?: boolean;
  onGenerate?: () => void;
  onFillForm?: () => void;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onMarkTaught?: () => void;
  onRestore?: () => void;
  onRemove?: () => void;
}

export const SuggestionActionsMenu: React.FC<SuggestionActionsMenuProps> = ({
  topic,
  generating,
  onGenerate,
  onFillForm,
  onEdit,
  onRegenerate,
  onMarkTaught,
  onRestore,
  onRemove,
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`More actions for ${topic}`}>
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-60">
      {onGenerate && (
        <DropdownMenuItem onClick={onGenerate}>
          <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" /> Generate worksheet
        </DropdownMenuItem>
      )}
      {onFillForm && (
        <DropdownMenuItem onClick={onFillForm}>
          <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden="true" /> Fill the form without generating
        </DropdownMenuItem>
      )}
      {onEdit && (
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Edit
        </DropdownMenuItem>
      )}
      {onRegenerate && (
        <DropdownMenuItem onClick={onRegenerate} disabled={generating}>
          <MessageSquarePlus className="mr-2 h-4 w-4" aria-hidden="true" /> Regenerate with a comment
        </DropdownMenuItem>
      )}
      {onMarkTaught && (
        <DropdownMenuItem onClick={onMarkTaught}>
          <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" /> Already taught
        </DropdownMenuItem>
      )}
      {onRestore && (
        <DropdownMenuItem onClick={onRestore}>
          <Undo2 className="mr-2 h-4 w-4" aria-hidden="true" /> Restore to the queue
        </DropdownMenuItem>
      )}
      {onRemove && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onRemove} className="text-destructive focus:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Remove
          </DropdownMenuItem>
        </>
      )}
    </DropdownMenuContent>
  </DropdownMenu>
);
