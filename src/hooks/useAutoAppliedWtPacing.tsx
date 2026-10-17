/**
 * useAutoAppliedWtPacing: the auto-applied first Welcome Test pacing (Decision 5)
 * and its undo. Undo reuses the teacher update path of usePacingProposals.accept:
 * update students (own teacher_id), then mark the proposal row.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { toast } from 'sonner';
import { devWarn } from '@/utils/logger';
import { selectAutoAppliedWtPacing, type AutoAppliedWtPacing, type PacingChangeRow } from '@/lib/dslm/pacingAutoApplied';

export const useAutoAppliedWtPacing = (studentId?: string) => {
  const { data: user } = useAuthUser();
  const teacherId = user?.id;
  const [applied, setApplied] = useState<AutoAppliedWtPacing | null>(null);
  const [undoing, setUndoing] = useState(false);

  const load = useCallback(async () => {
    if (!teacherId || !studentId) return;
    try {
      const [{ data: rows, error }, { data: student, error: sErr }] = await Promise.all([
        supabase
          .from('pacing_proposals')
          .select('id, status, trigger_type, trigger_details, current_pacing, proposed_pacing, created_at, decided_at')
          .eq('teacher_id', teacherId)
          .eq('student_id', studentId)
          .in('status', ['accepted', 'applied'])
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('students').select('dslm_pacing_mode').eq('id', studentId).eq('teacher_id', teacherId).maybeSingle(),
      ]);
      if (error) throw error;
      if (sErr) throw sErr;
      setApplied(selectAutoAppliedWtPacing((rows ?? []) as PacingChangeRow[], student?.dslm_pacing_mode));
    } catch (e) {
      devWarn('[useAutoAppliedWtPacing] load failed', e);
    }
  }, [teacherId, studentId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('pacingProposalChanged', handler);
    return () => window.removeEventListener('pacingProposalChanged', handler);
  }, [load]);

  const undo = async () => {
    if (!applied || !teacherId || !studentId) return;
    setUndoing(true);
    try {
      const { error: uErr } = await supabase
        .from('students')
        .update({
          dslm_pacing_mode: applied.previousPacing,
          last_pacing_set_manually: applied.previousLastPacingSetManually,
        })
        .eq('id', studentId)
        .eq('teacher_id', teacherId);
      if (uErr) throw uErr;

      const { error: pErr } = await supabase
        .from('pacing_proposals')
        .update({ status: 'reverted', decided_at: new Date().toISOString(), decided_by: teacherId })
        .eq('id', applied.proposalId);
      if (pErr) throw pErr;

      toast.success(`Pacing restored to ${applied.previousPacing}/100`);
      setApplied(null);
      window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
    } catch (e) {
      toast.error('Failed to undo', { description: e instanceof Error ? e.message : 'Unknown error' });
    } finally {
      setUndoing(false);
    }
  };

  return { applied, undoing, undo };
};
