/**
 * v6.9.14 — Reusable type-to-confirm delete modal.
 * Used for destructive ops where accidental click would lose user work
 * (Suggestion #1, Curriculum Phase, etc.).
 */
import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Human label of what is being deleted, e.g. "Suggestion #1" or "Phase 2". */
  label: string;
  /** Exact text the user must type (case-sensitive) to confirm. */
  expectedText: string;
  /** Optional extra description above the input. */
  description?: string;
  onConfirm: () => void | Promise<void>;
}

export const ConfirmTypeToDeleteDialog: React.FC<Props> = ({
  open, onOpenChange, label, expectedText, description, onConfirm,
}) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setText(''); setBusy(false); } }, [open]);

  const matches = text === expectedText;

  const handleConfirm = async () => {
    if (!matches) return;
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
        <div className="space-y-2">
          <Label htmlFor="confirm-type" className="text-xs">
            Type <span className="font-mono font-semibold">{expectedText}</span> to confirm
          </Label>
          <Input
            id="confirm-type"
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={expectedText}
            className="font-mono"
            onKeyDown={(e) => { if (e.key === 'Enter' && matches) handleConfirm(); }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!matches || busy}>
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
