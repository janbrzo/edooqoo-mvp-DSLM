/**
 * Teacher verdicts on Welcome Test signals (validation loop). One row per
 * teacher, student, test and signal (`wt_signal_feedback`); saving again
 * replaces the earlier verdict. A failed read or write never blocks the page.
 */
import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { FeedbackVerdict } from '@/lib/welcomeTest/profileDisplay';
import { FEEDBACK_COMMENT_MAX } from '@/lib/welcomeTest/profileDisplay';
import { devWarn } from '@/utils/logger';

export interface WtSignalFeedbackRow {
  id: string;
  signal_key: string;
  signal_value: string | null;
  verdict: FeedbackVerdict;
  comment: string | null;
  interpretation_version: number | null;
}

export interface SaveSignalFeedbackInput {
  signalKey: string;
  /** The value the teacher saw (trait value, "declared | observed", band name). */
  signalValue: string | null;
  verdict: FeedbackVerdict;
  comment?: string | null;
}

interface Args {
  studentId: string | undefined;
  teacherId: string | undefined;
  /** student_tests.id the profile belongs to; null when unknown. */
  testId: string | null | undefined;
  /** raw_answers.__interpretation_version__ of the profile being judged. */
  interpretationVersion: number | null | undefined;
}

const isDemoMode = (): boolean => {
  try { return localStorage.getItem('edooqoo_demo_mode') === 'true'; } catch { return false; }
};

export const wtSignalFeedbackKey = (studentId?: string, testId?: string | null) =>
  ['wt-signal-feedback', studentId, testId ?? null] as const;

/** Trims, caps at the column limit and turns empty text into null. */
export function normalizeFeedbackComment(comment: string | null | undefined): string | null {
  const trimmed = (comment ?? '').trim();
  return trimmed ? trimmed.slice(0, FEEDBACK_COMMENT_MAX) : null;
}

export function useWtSignalFeedback({ studentId, teacherId, testId, interpretationVersion }: Args) {
  const queryClient = useQueryClient();
  const enabled = !!studentId && !!teacherId && !isDemoMode();
  const queryKey = wtSignalFeedbackKey(studentId, testId);

  const query = useQuery({
    queryKey,
    enabled,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<WtSignalFeedbackRow[]> => {
      let q = supabase
        .from('wt_signal_feedback')
        .select('id, signal_key, signal_value, verdict, comment, interpretation_version')
        .eq('student_id', studentId as string)
        .eq('teacher_id', teacherId as string);
      q = testId ? q.eq('test_id', testId) : q.is('test_id', null);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as WtSignalFeedbackRow[];
    },
  });

  const mutation = useMutation({
    mutationFn: async (input: SaveSignalFeedbackInput) => {
      const { error } = await supabase.from('wt_signal_feedback').upsert(
        {
          teacher_id: teacherId as string,
          student_id: studentId as string,
          test_id: testId ?? null,
          signal_key: input.signalKey,
          signal_value: input.signalValue,
          verdict: input.verdict,
          comment: normalizeFeedbackComment(input.comment),
          interpretation_version: interpretationVersion ?? null,
        },
        { onConflict: 'teacher_id,student_id,test_id,signal_key' },
      );
      if (error) throw error;
    },
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey }); },
    onError: (err) => { devWarn('[useWtSignalFeedback] save failed', err); },
  });

  const byKey = useMemo(() => {
    const map: Record<string, WtSignalFeedbackRow> = {};
    for (const row of query.data ?? []) map[row.signal_key] = row;
    return map;
  }, [query.data]);

  const save = useCallback((input: SaveSignalFeedbackInput) => mutation.mutateAsync(input), [mutation]);

  return { byKey, save, saving: mutation.isPending, saveError: mutation.isError, enabled, isLoading: query.isLoading };
}

export type WtSignalFeedbackApi = ReturnType<typeof useWtSignalFeedback>;
