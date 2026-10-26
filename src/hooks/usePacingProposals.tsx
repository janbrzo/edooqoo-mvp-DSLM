/**
 * usePacingProposals: DSLM v4.9
 *
 * Manages pending pacing proposals for the current teacher.
 * Used by PacingProposalsBell (header) + PacingProposalCard (Pathway sidebar).
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthUser } from '@/hooks/useAuthUser';
import { toast } from 'sonner';
import { devWarn } from '@/utils/logger';
import { logDslmDecision, logDslmDecisionOnce } from '@/lib/dslm/decisionLog';
import { buildPacingDecisionPayload } from '@/lib/dslm/decisionPayloads';
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

/** Validation loop: the teacher was shown this proposal (once per proposal per browser session). */
export const logPacingProposalSeen = (proposal: PacingProposal, surface: string) => {
  logDslmDecisionOnce(`pacing-seen:${proposal.id}`, {
    studentId: proposal.student_id,
    type: 'pacing_proposal_seen',
    sourceId: proposal.id,
    payload: buildPacingDecisionPayload(proposal, { surface }),
  });
};

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

  const accepting = useRef(new Set<string>());

  const accept = async (proposal: PacingProposal) => {
    if (accepting.current.has(proposal.id)) return;
    accepting.current.add(proposal.id);
    let claimed = false;
    try {
      if (isPacingProposalExpired(proposal.created_at)) {
        toast.error('Proposal expired', { description: `Proposals older than ${PACING_PROPOSAL_MAX_AGE_DAYS} days are replaced by a fresh one at the next check.` });
        window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
        return;
      }
      // Claim the proposal first: only a still pending row can be accepted, so a stale tab
      // or a second click cannot overwrite a decision made elsewhere.
      const { data: claimedRows, error: cErr } = await (supabase as any)
        .from('pacing_proposals')
        .update({ status: 'accepted', decided_at: new Date().toISOString(), decided_by: teacherId })
        .eq('id', proposal.id)
        .eq('status', 'pending')
        .select('id');
      if (cErr) throw cErr;
      if (!claimedRows || claimedRows.length === 0) {
        toast.message('Proposal already handled', { description: 'It was accepted, dismissed or replaced elsewhere.' });
        window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
        return;
      }
      claimed = true;

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
          proposed_pacing: fresh,
          trigger_details: { ...(proposal.trigger_details || {}), originally_proposed: proposal.proposed_pacing },
        })
        .eq('id', proposal.id);
      if (pErr) devWarn('[usePacingProposals] could not store the fresh value on the proposal', pErr);

      toast.success(`Pacing updated to ${fresh}/100`, {
        description: `${proposal.student_name || 'Student'}: ${proposal.current_pacing} → ${fresh}`,
      });
      window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
      void logDslmDecision({
        studentId: proposal.student_id,
        type: 'pacing_proposal_accepted',
        sourceId: proposal.id,
        payload: buildPacingDecisionPayload(proposal, { applied_pacing: fresh }),
      });
    } catch (e: any) {
      if (claimed) {
        // The recompute failed after the claim: give the proposal back.
        await (supabase as any).from('pacing_proposals')
          .update({ status: 'pending', decided_at: null, decided_by: null })
          .eq('id', proposal.id).eq('status', 'accepted');
        window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
      }
      toast.error('Failed to accept', { description: e?.message || 'Unknown error' });
    } finally {
      accepting.current.delete(proposal.id);
    }
  };

  const reject = async (proposal: PacingProposal, reason?: string | null) => {
    try {
      const { error } = await (supabase as any)
        .from('pacing_proposals')
        .update({ status: 'rejected', decided_at: new Date().toISOString(), decided_by: teacherId })
        .eq('id', proposal.id);
      if (error) throw error;
      toast.message('Proposal dismissed', { description: `${proposal.student_name || 'Student'}: keeping ${proposal.current_pacing}/100` });
      window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
      void logDslmDecision({
        studentId: proposal.student_id,
        type: 'pacing_proposal_dismissed',
        sourceId: proposal.id,
        payload: buildPacingDecisionPayload(proposal, { reason }),
      });
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
