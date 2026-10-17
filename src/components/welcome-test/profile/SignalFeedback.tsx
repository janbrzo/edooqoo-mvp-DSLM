/**
 * Validation-loop controls: Agree / Partly / Disagree (+ optional note) next to
 * a Welcome Test signal. Renders nothing outside a <WtFeedbackProvider>, so the
 * profile blocks keep working where no feedback is wanted (and in unit tests).
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useWtSignalFeedback, type WtSignalFeedbackApi } from '@/hooks/useWtSignalFeedback';
import {
  FEEDBACK_COMMENT_MAX,
  FEEDBACK_HINT_TEXT,
  FEEDBACK_VERDICTS,
  FEEDBACK_VERDICT_LABELS,
  isFeedbackHintVisible,
  type FeedbackVerdict,
} from '@/lib/welcomeTest/profileDisplay';

const FeedbackContext = createContext<WtSignalFeedbackApi | null>(null);

interface ProviderProps {
  studentId: string;
  teacherId: string;
  testId: string | null | undefined;
  interpretationVersion: number | null | undefined;
  children: React.ReactNode;
}

export const WtFeedbackProvider: React.FC<ProviderProps> = ({ studentId, teacherId, testId, interpretationVersion, children }) => {
  const api = useWtSignalFeedback({ studentId, teacherId, testId, interpretationVersion });
  return <FeedbackContext.Provider value={api}>{children}</FeedbackContext.Provider>;
};

/** "Rate these after 2-4 lessons" hint, shown only for a test completed less than 14 days ago. */
export const FeedbackHint: React.FC<{ completedAt: string | null | undefined }> = ({ completedAt }) => {
  const api = useContext(FeedbackContext);
  if (!api || !api.enabled || !isFeedbackHintVisible(completedAt)) return null;
  return (
    <p className="text-[11px] text-muted-foreground" data-testid="wt-feedback-hint">
      {FEEDBACK_HINT_TEXT}
    </p>
  );
};

interface SignalFeedbackProps {
  signalKey: string;
  /** What the teacher is judging, stored as signal_value. */
  signalValue: string | null;
  className?: string;
}

export const SignalFeedback: React.FC<SignalFeedbackProps> = ({ signalKey, signalValue, className }) => {
  const api = useContext(FeedbackContext);
  const existing = api?.byKey[signalKey];
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(existing?.comment ?? '');

  useEffect(() => { setNote(existing?.comment ?? ''); }, [existing?.comment]);

  const verdict = existing?.verdict ?? null;
  const labelled = useMemo(() => `Your view on: ${signalValue ?? signalKey}`, [signalValue, signalKey]);

  if (!api || !api.enabled) return null;

  const submit = async (next: FeedbackVerdict, comment: string) => {
    try {
      await api.save({ signalKey, signalValue, verdict: next, comment });
    } catch {
      toast.error('Could not save your rating. Try again.');
    }
  };

  return (
    <div className={cn('space-y-1', className)} data-testid={`wt-feedback-${signalKey}`}>
      <div className="flex items-center gap-1 flex-wrap" role="group" aria-label={labelled}>
        {FEEDBACK_VERDICTS.map((v) => (
          <Button
            key={v}
            type="button"
            size="sm"
            variant={verdict === v ? 'default' : 'outline'}
            className="h-6 px-2 text-[11px]"
            aria-pressed={verdict === v}
            disabled={api.saving}
            onClick={() => { void submit(v, note); }}
          >
            {FEEDBACK_VERDICT_LABELS[v]}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-[11px] text-muted-foreground"
          onClick={() => setNoteOpen((o) => !o)}
          aria-expanded={noteOpen}
        >
          <MessageSquarePlus className="h-3 w-3 mr-1" aria-hidden="true" />
          {existing?.comment ? 'Note' : 'Add note'}
        </Button>
      </div>
      {noteOpen && (
        <div className="space-y-1">
          <Textarea
            value={note}
            maxLength={FEEDBACK_COMMENT_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you see in class? (optional)"
            className="min-h-[56px] text-xs"
            aria-label="Optional note"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-6 px-2 text-[11px]"
            disabled={api.saving || !verdict || note === (existing?.comment ?? '')}
            onClick={() => { if (verdict) void submit(verdict, note); }}
          >
            Save note
          </Button>
          {!verdict && <p className="text-[11px] text-muted-foreground">Pick Agree, Partly or Disagree first.</p>}
        </div>
      )}
    </div>
  );
};
