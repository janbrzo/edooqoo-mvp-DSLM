/**
 * SuggestedLevelChangeBanner — v6.9.49
 *
 * Reusable banner shown when a Welcome Test's estimated CEFR level differs
 * from the level currently set on the student profile. Mounts in both
 * TestDetailsView (test-scoped dismiss key) and DSLMTab (student-scoped),
 * so teachers see the suggestion regardless of which surface they open
 * first.
 *
 * Sanctity: no schema or Worksheet Generation Engine changes. Read-only
 * query against `student_learning_profiles` + idempotent update on
 * `students.english_level`.
 */
import { useEffect, useState } from 'react';
import { Loader2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SuggestedLevelChangeBannerProps {
  studentId: string;
  /** When provided, banner is scoped to a specific Welcome Test row; otherwise the latest profile estimate is used. */
  testId?: string;
  /** Required so we know whether the suggestion still applies. */
  currentLevel: string | null | undefined;
  /** Optional callback after a successful Apply (so parents can refresh local state). */
  onApplied?: (newLevel: string) => void;
}

export function SuggestedLevelChangeBanner({
  studentId,
  testId,
  currentLevel,
  onApplied,
}: SuggestedLevelChangeBannerProps) {
  const [estimatedLevel, setEstimatedLevel] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const dismissKey = testId
    ? `wt-level-change-dismissed:${testId}`
    : `wt-level-change-dismissed:student:${studentId}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(dismissKey) === '1'; } catch { return false; }
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let query = supabase
          .from('student_learning_profiles')
          .select('estimated_level, updated_at')
          .eq('student_id', studentId)
          .not('estimated_level', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1);
        if (testId) query = query.eq('welcome_test_id', testId);
        const { data } = await query;
        const lvl = Array.isArray(data) && data[0] ? String((data[0] as any).estimated_level || '') : '';
        if (!cancelled && lvl) setEstimatedLevel(lvl);
      } catch { /* silent — banner just stays hidden */ }
    })();
    return () => { cancelled = true; };
  }, [studentId, testId]);

  if (!currentLevel || !estimatedLevel || estimatedLevel === currentLevel || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(dismissKey, '1'); } catch { /* ignore */ }
  };

  const apply = async () => {
    setApplying(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({ english_level: estimatedLevel })
        .eq('id', studentId);
      if (error) throw error;
      dismiss();
      toast.success(`Student level updated to ${estimatedLevel}.`);
      onApplied?.(estimatedLevel);
    } catch (err) {
      console.error('[SuggestedLevelChangeBanner] level update failed', err);
      toast.error('Failed to update student level.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <TrendingUp className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm">Suggested level change: {currentLevel} → {estimatedLevel}</p>
              <p className="text-xs text-muted-foreground">
                Welcome Test results indicate a different CEFR level than the one set on the student profile.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={dismiss} disabled={applying}>
              Keep {currentLevel}
            </Button>
            <Button size="sm" onClick={apply} disabled={applying}>
              {applying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Apply {estimatedLevel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}