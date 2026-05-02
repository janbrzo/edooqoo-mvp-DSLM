/**
 * usePacingProposals — DSLM v4.9
 *
 * Manages pending pacing proposals for the current teacher.
 * Used by PacingProposalsBell (header) + PacingProposalCard (Pathway sidebar).
 */
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { toast } from 'sonner';

export interface PacingProposal {
  id: string;
  student_id: string;
  teacher_id: string;
  trigger_type: 'goal_added' | 'placement_test' | 'periodic_30d' | 'manual';
  trigger_details: Record<string, unknown>;
  current_pacing: number;
  proposed_pacing: number;
  reasoning: string[];
  status: 'pending' | 'accepted' | 'rejected' | 'superseded';
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
      const rows = (data || []) as PacingProposal[];
      const ids = Array.from(new Set(rows.map(r => r.student_id)));
      if (ids.length) {
        const { data: students } = await supabase
          .from('students').select('id, name').in('id', ids);
        const nameById = new Map((students || []).map((s: any) => [s.id, s.name]));
        rows.forEach(r => { r.student_name = nameById.get(r.student_id) || 'Student'; });
      }
      setProposals(rows);
    } catch (e) {
      console.warn('[usePacingProposals] fetch failed', e);
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
      const { error: uErr } = await supabase
        .from('students')
        .update({ dslm_pacing_mode: proposal.proposed_pacing } as any)
        .eq('id', proposal.student_id)
        .eq('teacher_id', teacherId!);
      if (uErr) throw uErr;

      const { error: pErr } = await (supabase as any)
        .from('pacing_proposals')
        .update({ status: 'accepted', decided_at: new Date().toISOString(), decided_by: teacherId })
        .eq('id', proposal.id);
      if (pErr) throw pErr;

      toast.success(`Pacing updated to ${proposal.proposed_pacing}/100`, {
        description: `${proposal.student_name || 'Student'} — ${proposal.current_pacing} → ${proposal.proposed_pacing}`,
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
      toast.message('Proposal dismissed', { description: `${proposal.student_name || 'Student'} — keeping ${proposal.current_pacing}/100` });
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
