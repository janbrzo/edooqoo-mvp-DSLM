/**
 * usePacingProposals: DSLM v4.9
 *
 * Manages pending pacing proposals for the current teacher.
 * Used by PacingProposalsBell (header) + PacingProposalCard (Pathway sidebar).
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { toast } from 'sonner';
import { devWarn } from '@/utils/logger';
import { PACING_PROPOSAL_MAX_AGE_DAYS, isPacingProposalExpired } from '../../supabase/functions/_shared/pacing';

export interface PacingProposal {
  id: string;
  student_id: string;
  teacher_id: string;
  trigger_type: 'goal_added' | 'placement_test' | 'periodic_30d' | 'manual';
  trigger_details: Record<string, unknown>;
  current_pacing: number;
  proposed_pacing: number;
  reasoning: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'superseded' | 'reverted';
  decided_at: string | null;
  created_at: string;
  // joined student name (best-effort)
  student_name?: string;
}

export const usePacingProposals = (studentId?: string) => {
  const { data: user } = useAuthUser();
  const teacherId = user?.id;
  const [proposals, setProposals] = useState<PacingProposal[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!teacherId) return;
    setLoading(true);
    try {
      let q = (supabase as any)
        .from('pacing_proposals')
        .select('*')
        .eq('teacher_id', teacherId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (studentId) q = q.eq('student_id', studentId);
      const { data, error } = await q;
      if (error) throw error;

      // Best-effort join with student names
      // Proposals older than PACING_PROPOSAL_MAX_AGE_DAYS are expired (D11).
      const rows = ((data || []) as PacingProposal[]).filter((r) => !isPacingProposalExpired(r.created_at));
      const ids = Array.from(new Set(rows.map(r => r.student_id)));
      if (ids.length) {
        const { data: students } = await supabase
          .from('students').select('id, name').in('id', ids);
        const nameById = new Map((students || []).map((s: any) => [s.id, s.name]));
        rows.forEach(r => { r.student_name = nameById.get(r.student_id) || 'Student'; });
      }
      setProposals(rows);
    } catch (e) {
      devWarn('[usePacingProposals] fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [teacherId, studentId]);

  useEffect(() => { fetch(); }, [fetch]);

  // realtime refresh on cross-component changes
  useEffect(() => {
    const handler = () => fetch();
    window.addEventListener('pacingProposalChanged', handler);
    return () => window.removeEventListener('pacingProposalChanged', handler);
  }, [fetch]);

  const accept = async (proposal: PacingProposal) => {
    try {
      if (isPacingProposalExpired(proposal.created_at)) {
        toast.error('Proposal expired', { description: `Proposals older than ${PACING_PROPOSAL_MAX_AGE_DAYS} days are recalculated by the next check.` });
        window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
        return;
      }
      // D11: the stored proposed value may be stale (goals, metrics and the Welcome Test
      // moved on). Accepting recomputes it with recalculate-pacing (apply mode: writes the
      // value and last_pacing_set_manually = false) instead of applying the old number.
      const { data: res, error: rErr } = await supabase.functions.invoke('recalculate-pacing', {
        body: { studentId: proposal.student_id, teacherId, mode: 'apply', triggerType: 'proposal_accepted' },
      });
      if (rErr) throw rErr;
      const fresh = Number((res as any)?.pacingMode);
      if (!Number.isFinite(fresh)) throw new Error('Pacing could not be recalculated');

      const { error: pErr } = await (supabase as any)
        .from('pacing_proposals')
        .update({
          status: 'accepted',
          decided_at: new Date().toISOString(),
          decided_by: teacherId,
          proposed_pacing: fresh,
          trigger_details: { ...(proposal.trigger_details || {}), originally_proposed: proposal.proposed_pacing },
        })
        .eq('id', proposal.id);
      if (pErr) throw pErr;

      toast.success(`Pacing updated to ${fresh}/100`, {
        description: `${proposal.student_name || 'Student'}: ${proposal.current_pacing} → ${fresh}`,
      });
      window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
    } catch (e: any) {
      toast.error('Failed to accept', { description: e?.message || 'Unknown error' });
    }
  };

  const reject = async (proposal: PacingProposal) => {
    try {
      const { error } = await (supabase as any)
        .from('pacing_proposals')
        .update({ status: 'rejected', decided_at: new Date().toISOString(), decided_by: teacherId })
        .eq('id', proposal.id);
      if (error) throw error;
      toast.message('Proposal dismissed', { description: `${proposal.student_name || 'Student'}: keeping ${proposal.current_pacing}/100` });
      window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
    } catch (e: any) {
      toast.error('Failed to reject', { description: e?.message || 'Unknown error' });
    }
  };

  return { proposals, loading, refetch: fetch, accept, reject, count: proposals.length };
};

export const triggerLabel = (t: PacingProposal['trigger_type']): string => {
  switch (t) {
    case 'goal_added': return 'New goal added';
    case 'placement_test': return 'Placement test completed';
    case 'periodic_30d': return '30-day check-in';
    case 'manual': return 'Manual recheck';
    default: return t;
  }
};
