/**
 * v6.9.15c — Single-click confirm dialog for destructive DSLM actions.
 * Replaces the type-to-confirm UX (`ConfirmTypeToDeleteDialog`) per product decision.
 */
import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Human label of what is being deleted, e.g. "Next Step #1" or "Phase 2". */
  label: string;
  /** Optional extra description above the buttons. */
  description?: string;
  /** Defaults to "Confirm". */
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
}

export const ConfirmDeleteDialog: React.FC<Props> = ({
  open, onOpenChange, label, description, confirmLabel = 'Confirm', onConfirm,
}) => {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try { await onConfirm(); onOpenChange(false); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {label}?</DialogTitle>
          <DialogDescription>
            {description || 'This action cannot be undone.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={busy}>
            <Trash2 className="h-4 w-4 mr-2" /> {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
