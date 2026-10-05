/**
 * useWelcomeTestState — compact Welcome Test status for the Learning plan
 * setup checklist: never issued / sent and waiting / completed.
 *
 * Read-only; the actions (send, copy link) stay in `useWelcomeTestActions`.
 * Returns early in demo mode (demo ids are not UUIDs).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDemoContext } from '@/contexts/DemoContext';
import { devWarn } from '@/utils/logger';
import { resolveWelcomeTestState, type WelcomeTestState } from '@/lib/dslm/modelReadiness';

export const welcomeTestStateKey = (studentId: string, teacherId: string) =>
  ['welcome-test-state', studentId, teacherId] as const;

export function useWelcomeTestState(studentId: string, teacherId: string): {
  state: WelcomeTestState;
  sentAt: string | null;
  isLoading: boolean;
  refetch: () => void;
} {
  const { isDemoMode } = useDemoContext();
  const queryClient = useQueryClient();
  const enabled = !isDemoMode && !!studentId && !!teacherId;

  const query = useQuery({
    queryKey: welcomeTestStateKey(studentId, teacherId),
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_tests')
        .select('status, created_at')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .eq('test_type', 'welcome')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) {
        devWarn('[useWelcomeTestState] failed', error);
        return resolveWelcomeTestState([]);
      }
      return resolveWelcomeTestState(data ?? []);
    },
  });

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: welcomeTestStateKey(studentId, teacherId) });
  }, [queryClient, studentId, teacherId]);

  return {
    state: query.data?.state ?? 'none',
    sentAt: query.data?.sentAt ?? null,
    isLoading: enabled && query.isLoading,
    refetch,
  };
}
