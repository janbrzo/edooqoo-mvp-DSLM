/**
 * PacingModeSlider — DSLM v4.4 UI for "Scientific ↔ Pragmatic" spectrum (0-100).
 *
 * 0-30  = Scientific  (strict Natural Order Hypothesis)
 * 31-69 = Balanced    (default 50)
 * 70-100 = Pragmatic  (TBLT-first, just-in-time grammar)
 *
 * Stored in students.dslm_pacing_mode. Auto-computed in EF if teacher leaves default.
 */
import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Gauge, Info, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { devWarn } from '@/utils/logger';

interface PacingModeSliderProps {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  /** When provided, enables the "Auto AI Recalculate" button (v4.7). */
  studentId?: string;
  teacherId?: string;
}

export const pacingLabel = (v: number): 'Scientific' | 'Balanced' | 'Pragmatic' => {
  if (v <= 30) return 'Scientific';
  if (v >= 70) return 'Pragmatic';
  return 'Balanced';
};

const labelColor = (v: number) => {
  if (v <= 30) return 'bg-blue-500/15 text-blue-700 border-blue-500/30';
  if (v >= 70) return 'bg-orange-500/15 text-orange-700 border-orange-500/30';
  return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30';
};

export const PacingModeSlider: React.FC<PacingModeSliderProps> = ({
  value,
  onChange,
  disabled,
  studentId,
  teacherId,
}) => {
  const label = pacingLabel(value);
  const [recalculating, setRecalculating] = React.useState(false);
  const [lastInfo, setLastInfo] = React.useState<{
    reasoning: string[];
    proposed?: number;
    current?: number;
    at?: string;
    setManually?: boolean;
  } | null>(null);

  // Load last reasoning + manual flag once when popover student is known.
  React.useEffect(() => {
    if (!studentId || !teacherId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('students')
          .select('last_pacing_reasoning, last_pacing_recalc_at, last_pacing_set_manually')
          .eq('id', studentId)
          .eq('teacher_id', teacherId)
          .maybeSingle();
        if (cancelled || !data) return;
        const r = data.last_pacing_reasoning || null;
        setLastInfo({
          reasoning: Array.isArray(r?.reasoning) ? r.reasoning : [],
          proposed: r?.proposed,
          current: r?.current,
          at: data.last_pacing_recalc_at || r?.at,
          setManually: !!data.last_pacing_set_manually,
        });
      } catch (e) { devWarn('[PacingModeSlider] load last_pacing_reasoning failed', e); }
    })();
    return () => { cancelled = true; };
  }, [studentId, teacherId, recalculating]);

  // Manual drag → flag the value as teacher-set.
  const handleManualChange = React.useCallback((next: number) => {
    onChange(next);
    if (studentId && teacherId) {
      (supabase as any)
        .from('students')
        .update({ last_pacing_set_manually: true })
        .eq('id', studentId)
        .eq('teacher_id', teacherId)
        .then(() => setLastInfo(prev => prev ? { ...prev, setManually: true } : prev))
        .then(undefined, (e: any) => devWarn('[PacingModeSlider] manual flag update failed', e));
    }
  }, [onChange, studentId, teacherId]);

  const handleRecalculate = async () => {
    if (!studentId || !teacherId) return;
    setRecalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke('recalculate-pacing', {
        body: { studentId, teacherId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const newPacing = typeof data?.pacingMode === 'number' ? data.pacingMode : null;
      if (newPacing === null) throw new Error('No pacing returned');
      onChange(newPacing);
      const reasons: string[] = Array.isArray(data?.reasoning) ? data.reasoning : [];
      toast.success(`Pacing recalculated: ${newPacing}/100`, {
        description: reasons.length ? reasons.slice(0, 3).join(' · ') : 'Updated from latest mastery & goal signals.',
      });
      setLastInfo({ reasoning: reasons, proposed: newPacing, current: data?.current, at: new Date().toISOString(), setManually: false });
    } catch (e: any) {
      toast.error('Recalculate failed', { description: e?.message || 'Unknown error' });
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 gap-1.5 text-[11px] text-muted-foreground"
          disabled={disabled}
        >
          <Gauge className="h-3.5 w-3.5" />
          <span>Pacing</span>
          <Badge variant="outline" className={cn('text-[9px] py-0 h-4', labelColor(value))}>
            {label} · {value}
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Gauge className="h-4 w-4" />
                Learning Pacing
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Controls how the AI plans phases & next steps.
              </p>
            </div>
            <Badge variant="outline" className={cn('text-[10px]', labelColor(value))}>
              {label}
            </Badge>
          </div>

          <div className="space-y-2 pt-1">
            <Slider
              value={[value]}
              onValueChange={(vals) => handleManualChange(vals[0])}
              min={0}
              max={100}
              step={5}
              disabled={disabled}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Scientific</span>
              <span>Balanced</span>
              <span>Pragmatic</span>
            </div>
            <div className="text-center text-xs font-medium text-foreground">{value}/100</div>
          </div>

          {studentId && teacherId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              disabled={recalculating || disabled}
              className="w-full h-7 text-[11px] gap-1.5"
            >
              {recalculating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              Auto AI Recalculate
            </Button>
          )}

          <p className="text-[10px] text-muted-foreground text-center -mt-1">
            Granular 0–100 scale: each value tunes input/output ratio, grammar explicitness & immersion. Buckets are display labels only.
          </p>

          <div className="rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground space-y-1.5">
            <div className="flex items-start gap-1.5">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <div>
                {label === 'Scientific' && (
                  <span><b>Scientific (0-30):</b> Strict Natural Order (Krashen). Grammar order respected. Best for A1/A2 or academic/exam goals.</span>
                )}
                {label === 'Balanced' && (
                  <span><b>Balanced (31-69):</b> Natural order respected, but topics anchored in student's domain from lesson 1. Default for most learners.</span>
                )}
                {label === 'Pragmatic' && (
                  <span><b>Pragmatic (70-100):</b> Task-based, just-in-time grammar. Ready-to-use phrases first. Best for short deadlines or work/travel goals.</span>
                )}
              </div>
            </div>
          </div>

          {/* v5.1 — Last calculation reasoning */}
          <div className="rounded-md border border-border p-2 text-[11px] space-y-1">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="h-3 w-3" /> Last calculation
            </div>
            {lastInfo?.setManually ? (
              <p className="text-muted-foreground">
                Manually set by teacher{lastInfo.at ? ` · ${new Date(lastInfo.at).toLocaleDateString()}` : ''}.
              </p>
            ) : lastInfo && lastInfo.reasoning.length > 0 ? (
              <>
                <p className="text-muted-foreground">
                  {lastInfo.current ?? '?'} → {lastInfo.proposed ?? value}
                  {lastInfo.at ? ` · ${new Date(lastInfo.at).toLocaleDateString()}` : ''}
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  {lastInfo.reasoning.slice(0, 5).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </>
            ) : (
              <p className="text-muted-foreground italic">No automatic calculation yet — click "Auto AI Recalculate" to compute one.</p>
            )}
          </div>

          <a
            href="/blog/learning-pacing-scientific-vs-pragmatic-esl.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-[11px] text-primary hover:text-primary/80 underline decoration-dotted underline-offset-4"
          >
            <BookOpen className="h-3 w-3" />
            Learn more about Learning Pacing
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
};
