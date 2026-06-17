// v6.9.62 P6 — Opt-in "Paste notes about student" section embedded in
// AddStudentDialog. Calls extract-student-profile edge function and renders
// ExtractionPreviewCard. Does NOT touch the DB; commit happens on form submit.
import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDemoContext } from '@/contexts/DemoContext';
import { ExtractionPreviewCard } from './ExtractionPreviewCard';
import type { IntakeExtractionPayload, IntakeIncludes } from '@/lib/intake/applyIntakeExtraction';

const MIN_LEN = 40;
const MAX_LEN = 4000;

interface Props {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  rawText: string;
  onRawTextChange: (v: string) => void;
  extraction: IntakeExtractionPayload | null;
  onExtractionChange: (v: IntakeExtractionPayload | null) => void;
  includes: IntakeIncludes;
  setIncludes: React.Dispatch<React.SetStateAction<IntakeIncludes>>;
  existing: {
    english_level?: string | null;
    main_goal?: string | null;
    main_goal_target_date?: string | null;
    native_language?: string | null;
    mainGoalSet?: boolean;
  };
  model: string | null;
  onModelResolved: (model: string) => void;
}

export const PasteIntakeSection: React.FC<Props> = ({
  enabled,
  onEnabledChange,
  rawText,
  onRawTextChange,
  extraction,
  onExtractionChange,
  includes,
  setIncludes,
  existing,
  onModelResolved,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<number | null>(null);
  const { isDemoMode, showDemoBlockedToast } = useDemoContext();

  const tooShort = rawText.trim().length < MIN_LEN;
  const tooLong = rawText.length > MAX_LEN;

  const handleAnalyze = async () => {
    if (isDemoMode) {
      showDemoBlockedToast('AI paste extraction');
      return;
    }
    if (tooShort || tooLong || analyzing) return;
    // 60s in-memory throttle
    if (lastAnalyzedAt && Date.now() - lastAnalyzedAt < 60_000) {
      toast.info('Please wait a moment before re-analyzing.');
      return;
    }
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-student-profile', {
        body: {
          raw_text: rawText,
          existing_profile: existing,
        },
      });
      if (error) {
        const status = (error as any)?.context?.status;
        if (status === 429) toast.error('Rate limited — please wait a minute.');
        else if (status === 402) toast.error('AI credits exhausted — add credits in workspace settings.');
        else toast.error('AI extraction failed. You can still create the student.');
        onExtractionChange(null);
        return;
      }
      const ext: IntakeExtractionPayload | undefined = (data as any)?.extraction;
      const model: string | undefined = (data as any)?.model;
      if (!ext) {
        toast.error("Couldn't read AI response. Try again.");
        onExtractionChange(null);
        return;
      }
      if (model) onModelResolved(model);
      onExtractionChange(ext);
      setLastAnalyzedAt(Date.now());
      // Reset includes default to all-on for every new extraction.
      setIncludes({
        notes: true,
        signals: {},
        goals: {},
        english_level: true,
        main_goal: true,
        native_language: true,
        pacing: true,
      });
    } catch (e) {
      console.error('[PasteIntakeSection] analyze failed', e);
      toast.error('AI is busy. You can still create the student.');
      onExtractionChange(null);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2 rounded-md border bg-muted/20 p-2.5">
        <div className="flex-1">
          <Label className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
            Paste notes about student to set up profile (AI, optional)
          </Label>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Drop an email, intake form, or your meeting notes — AI will extract goals, signals and level.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} aria-label="Paste notes toggle" />
      </div>

      {enabled ? (
        <div className="space-y-2 border-l-2 border-violet-300/60 pl-3">
          <Textarea
            value={rawText}
            onChange={(e) => onRawTextChange(e.target.value.slice(0, MAX_LEN))}
            placeholder="Paste anything you know about the student here…"
            className="min-h-[100px] text-xs"
            maxLength={MAX_LEN}
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{rawText.length}/{MAX_LEN} chars · stored only on your account</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleAnalyze}
              disabled={tooShort || tooLong || analyzing}
              className="h-7 text-[11px]"
            >
              {analyzing ? (
                <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Analyzing…</>
              ) : (
                <><Sparkles className="h-3 w-3 mr-1" />{extraction ? 'Re-analyze' : 'Analyze with AI'}</>
              )}
            </Button>
          </div>

          {extraction ? (
            <ExtractionPreviewCard
              extraction={extraction}
              includes={includes}
              setIncludes={setIncludes}
              existing={{
                english_level: existing.english_level ?? null,
                main_goal: existing.main_goal ?? null,
                native_language: existing.native_language ?? null,
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default PasteIntakeSection;