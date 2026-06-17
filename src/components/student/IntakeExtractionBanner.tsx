// v6.9.62 P6 — Banner shown on /student/:id when `?intake=<extraction_id>` is
// present in the URL. Lets the teacher review what was applied and bulk-undo.
import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Sparkles, Undo2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { rollbackIntakeExtraction } from '@/lib/intake/applyIntakeExtraction';
import { toast } from 'sonner';
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

interface Row {
  id: string;
  status: string;
  created_entry_ids: string[];
  created_goal_ids: string[];
  created_pacing_proposal_id: string | null;
  applied_student_updates: Record<string, unknown>;
}

export const IntakeExtractionBanner: React.FC<{ extractionId: string; studentId: string; onDismiss?: () => void }> = ({
  extractionId,
  onDismiss,
}) => {
  const [row, setRow] = useState<Row | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from('student_intake_extractions')
        .select('id,status,created_entry_ids,created_goal_ids,created_pacing_proposal_id,applied_student_updates')
        .eq('id', extractionId)
        .maybeSingle();
      if (!cancelled) setRow(data as Row | null);
    })();
    return () => { cancelled = true; };
  }, [extractionId]);

  if (!row) return null;

  const autoCount = (row.created_entry_ids?.length ?? 0) + (row.created_goal_ids?.length ?? 0)
    + Object.keys(row.applied_student_updates ?? {}).length;
  const pendingCount = row.created_pacing_proposal_id ? 1 : 0;

  if (row.status === 'rolled_back') {
    return (
      <Alert className="mb-3">
        <Sparkles className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between gap-2">
          <span>Intake extraction has been rolled back. Nothing from that paste remains active.</span>
          {onDismiss ? <Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button> : null}
        </AlertDescription>
      </Alert>
    );
  }

  const handleUndo = async () => {
    setBusy(true);
    try {
      await rollbackIntakeExtraction(extractionId);
      toast.success('Intake suggestions rolled back.');
      setRow({ ...row, status: 'rolled_back' });
    } catch (e: any) {
      toast.error(`Could not roll back: ${e?.message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <>
      <Alert className="mb-3 border-violet-300/60 bg-violet-50/60">
        <Sparkles className="h-4 w-4 text-violet-600" />
        <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm">
            Profile seeded from your notes — <strong>{autoCount}</strong> auto-applied
            {pendingCount ? <> · <strong>{pendingCount}</strong> pending pacing proposal</> : null}.
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirm(true)}
              disabled={busy}
              className="h-7 text-xs"
            >
              <Undo2 className="h-3 w-3 mr-1" /> Undo all
            </Button>
            {onDismiss ? (
              <Button variant="ghost" size="sm" onClick={onDismiss} className="h-7 text-xs">Dismiss</Button>
            ) : null}
          </div>
        </AlertDescription>
      </Alert>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo all intake suggestions?</AlertDialogTitle>
            <AlertDialogDescription>
              This archives every entry, goal and rejects the pending pacing proposal created from this paste.
              Profile fields the AI set are restored to their previous values. This action is reversible only via support.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUndo} disabled={busy}>
              {busy ? 'Rolling back…' : 'Undo all'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default IntakeExtractionBanner;