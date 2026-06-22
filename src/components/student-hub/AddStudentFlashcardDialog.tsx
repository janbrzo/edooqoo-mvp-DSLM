// v6.9.62 P7 — Lets a student add a flashcard to one of their shared sets.
// Uses the SECURITY DEFINER RPC `student_add_flashcard` which enforces
// student_email == student.student_email + allow_student_contributions=true.
//
// v6.9.67 — UX parity with teacher AddFlashcardModal: dynamic labels per
// set.back_type (translation vs definition), AI auto-suggest via
// useFlashcardTranslation / useFlashcardDefinition, CEFR preview badge.
import React, { useEffect, useState } from 'react';
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
import { useFlashcardTranslation } from '@/hooks/useFlashcardTranslation';
import { useFlashcardDefinition } from '@/hooks/useFlashcardDefinition';

interface Props {
  setId: string;
  setTitle: string;
  studentEmail: string;
  backType: 'translation' | 'definition';
  studentNativeLanguage: string;
  onAdded?: () => void;
}

export const AddStudentFlashcardDialog: React.FC<Props> = ({
  setId, setTitle, studentEmail, backType, studentNativeLanguage, onAdded,
}) => {
  const [open, setOpen] = useState(false);
  const [frontText, setFrontText] = useState('');
  const [frontExample, setFrontExample] = useState('');
  const [backText, setBackText] = useState('');
  const [userEditedBackText, setUserEditedBackText] = useState(false);
  const [busy, setBusy] = useState(false);

  const nativeLang = studentNativeLanguage || 'English';

  const {
    translation, cefrLevel: translationCefr, isTranslating,
    translateText, clearTranslation,
  } = useFlashcardTranslation({
    targetLanguage: nativeLang,
    enabled: backType === 'translation' && !!nativeLang,
  });

  const {
    definition, cefrLevel: definitionCefr, isLoadingDefinition,
    fetchDefinition, clearDefinition,
  } = useFlashcardDefinition({ enabled: backType === 'definition' });

  const currentCefr = backType === 'translation' ? translationCefr : definitionCefr;

  const reset = () => {
    setFrontText(''); setFrontExample(''); setBackText('');
    setUserEditedBackText(false);
    clearTranslation(); clearDefinition();
  };

  // Auto-translate / auto-define on front change (debounced inside hooks).
  useEffect(() => {
    if (backType === 'translation' && nativeLang && frontText.trim().length > 2 && !userEditedBackText) {
      translateText(frontText);
    }
  }, [frontText, backType, nativeLang, translateText, userEditedBackText]);

  useEffect(() => {
    if (backType === 'definition' && frontText.trim().length > 2 && !userEditedBackText) {
      fetchDefinition(frontText);
    }
  }, [frontText, backType, fetchDefinition, userEditedBackText]);

  // Mirror auto-suggested value into the back field (unless user edited it).
  useEffect(() => {
    if (backType === 'translation' && translation && !userEditedBackText) {
      setBackText(translation);
    }
  }, [translation, backType, userEditedBackText]);

  useEffect(() => {
    if (backType === 'definition' && definition && !userEditedBackText) {
      setBackText(definition);
    }
  }, [definition, backType, userEditedBackText]);

  const handleSubmit = async () => {
    if (!frontText.trim() || !backText.trim()) {
      toast.error('Front and back are both required.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc('student_add_flashcard', {
        p_set_id: setId,
        p_student_email: studentEmail,
        p_front: frontText.trim(),
        p_back: backText.trim(),
        p_native: null,
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

  const backLabel = backType === 'translation'
    ? `${nativeLang} Translation *`
    : 'English Definition *';
  const backPlaceholder = backType === 'translation'
    ? `Translation in ${nativeLang}...`
    : 'Definition in English...';

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <Button size="sm" variant="outline" className="flex-1" onClick={() => setOpen(true)}>
        <Plus className="w-3 h-3 mr-1" /> Add card
      </Button>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add a flashcard</DialogTitle>
          <DialogDescription>To "{setTitle}". Your teacher will see new cards.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="sh-front">English Term *</Label>
            <Input
              id="sh-front"
              value={frontText}
              onChange={(e) => setFrontText(e.target.value)}
              placeholder="e.g., accomplish"
              maxLength={200}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="sh-example">Example Sentence (optional)</Label>
            <Textarea
              id="sh-example"
              value={frontExample}
              onChange={(e) => setFrontExample(e.target.value)}
              placeholder="e.g., She accomplished her goal of learning English."
              rows={2}
              maxLength={500}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="sh-back">{backLabel}</Label>
            <div className="relative">
              <Input
                id="sh-back"
                value={backText}
                onChange={(e) => { setBackText(e.target.value); setUserEditedBackText(true); }}
                placeholder={backPlaceholder}
                maxLength={1000}
                className="mt-1.5"
              />
              {(isTranslating || isLoadingDefinition) && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            {backType === 'translation' && translation && !userEditedBackText && (
              <p className="text-xs text-muted-foreground mt-1">💡 Auto-suggested translation</p>
            )}
            {backType === 'definition' && definition && !userEditedBackText && (
              <p className="text-xs text-muted-foreground mt-1">💡 Auto-suggested definition</p>
            )}
          </div>

          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <span>Preview:</span>
              {currentCefr && (
                <span className="px-1.5 py-0.5 rounded text-xs border font-medium bg-background">{currentCefr}</span>
              )}
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Front:</span>{' '}
                <span className="font-medium">{frontText || '(empty)'}</span>
              </div>
              {frontExample && (
                <div className="text-xs italic text-muted-foreground">"{frontExample}"</div>
              )}
              <div>
                <span className="text-muted-foreground">Back:</span>{' '}
                <span>{backText || '(empty)'}</span>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy || !frontText.trim() || !backText.trim()}>
            {busy ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Saving…</> : 'Save card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddStudentFlashcardDialog;