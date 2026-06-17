// v6.9.62 P7 — Lets a student add a flashcard to one of their shared sets.
// Uses the SECURITY DEFINER RPC `student_add_flashcard` which enforces
// student_email == student.student_email + allow_student_contributions=true.
import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  setId: string;
  setTitle: string;
  studentEmail: string;
  hasNative: boolean;
  onAdded?: () => void;
}

export const AddStudentFlashcardDialog: React.FC<Props> = ({
  setId, setTitle, studentEmail, hasNative, onAdded,
}) => {
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [native, setNative] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setFront(''); setBack(''); setNative(''); };

  const handleSubmit = async () => {
    if (!front.trim() || !back.trim()) {
      toast.error('Front and back are both required.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc('student_add_flashcard', {
        p_set_id: setId,
        p_student_email: studentEmail,
        p_front: front,
        p_back: back,
        p_native: native || null,
      });
      if (error) {
        const msg = String(error.message || '');
        if (msg.includes('contributions_disabled')) toast.error('Your teacher has disabled student additions for this set.');
        else if (msg.includes('student_not_authorized')) toast.error("Couldn't verify your email for this set.");
        else if (msg.includes('empty_card')) toast.error('Front and back are required.');
        else toast.error('Could not save the card. Try again.');
        return;
      }
      toast.success('Card added!');
      reset();
      setOpen(false);
      onAdded?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpen(true)}>
        <Plus className="w-3 h-3 mr-1" /> Add card
      </Button>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a flashcard</DialogTitle>
          <DialogDescription>To "{setTitle}". Your teacher will see new cards.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Front (word or phrase)</Label>
            <Input value={front} onChange={(e) => setFront(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Back (definition or translation)</Label>
            <Textarea value={back} onChange={(e) => setBack(e.target.value)} maxLength={1000} className="min-h-[80px]" />
          </div>
          {hasNative ? (
            <div className="space-y-1">
              <Label className="text-xs">Native translation (optional)</Label>
              <Input value={native} onChange={(e) => setNative(e.target.value)} maxLength={200} />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving…</> : 'Save card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddStudentFlashcardDialog;