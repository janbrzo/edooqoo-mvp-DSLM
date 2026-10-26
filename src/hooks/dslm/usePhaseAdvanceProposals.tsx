/**
 * usePhaseAdvanceProposals: proposals to move the plan to the next phase (audit 9.6, D14).
 *
 * Loads the student's proposals, creates one when the evidence supports advancing the
 * in-progress phase and none exists for it, and lets the teacher accept or dismiss.
 * Never applies anything by itself. The unique partial index on (phase_id) where
 * status = 'pending' makes concurrent creation safe (a unique violation is ignored).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { devWarn } from '@/utils/logger';
import {
  decidePhaseAdvanceProposal,
  findNextPlannedPhase,
  type PhaseAdvanceEvidence,
  type PlanPhaseSignals,
} from '@/lib/dslm/planSignalsView';

export interface PhaseAdvanceProposal {
  id: string;
  student_id: string;
  teacher_id: string;
  phase_id: string;
  next_phase_id: string | null;
  status: 'pending' | 'accepted' | 'dismissed' | 'superseded';
  evidence: Partial<PhaseAdvanceEvidence> | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

interface PhaseLite extends PlanPhaseSignals { title: string }

interface Props {
  studentId: string;
  teacherId: string;
  phases: readonly PhaseLite[];
  currentPhase: PhaseLite | null;
  metrics: any[];
  metricsLoaded: boolean;
  plansReady: boolean;
  /** `updatePhase` of useCurriculumPhases: the existing path for phase status changes. */
  updatePhase: (id: string, fields: { status: any }) => Promise<boolean>;
}

const isDemo = (): boolean => {
  try { return localStorage.getItem('edooqoo_demo_mode') === 'true'; } catch { return false; }
};
const EVENT = 'phaseAdvanceProposalChanged';

export const usePhaseAdvanceProposals = ({
  studentId, teacherId, phases, currentPhase, metrics, metricsLoaded, plansReady, updatePhase,
}: Props) => {
  const [rows, setRows] = useState<PhaseAdvanceProposal[] | null>(null);
  const creating = useRef(new Set<string>());
  const busy = useRef(new Set<string>());

  const fetchRows = useCallback(async () => {
    if (!studentId || !teacherId || isDemo()) { setRows([]); return; }
    try {
      const { data, error } = await (supabase as any)
        .from('phase_advance_proposals')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data || []) as PhaseAdvanceProposal[]);
    } catch (e) {
      devWarn('[usePhaseAdvanceProposals] fetch failed', e);
      setRows([]);
    }
  }, [studentId, teacherId]);

  useEffect(() => { void fetchRows(); }, [fetchRows]);
  useEffect(() => {
    const h = () => { void fetchRows(); };
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, [fetchRows]);

  const emit = () => window.dispatchEvent(new CustomEvent(EVENT));
  const phaseById = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases]);

  // Only a proposal for the phase that is still in progress stays visible.
  const proposals = useMemo(
    () => (rows ?? []).filter((r) => r.status === 'pending' && phaseById.get(r.phase_id)?.status === 'in_progress'),
    [rows, phaseById],
  );

  // Housekeeping: a pending proposal whose phase moved on (done, deleted) is superseded.
  useEffect(() => {
    if (!rows || !plansReady || isDemo()) return;
    const stale = rows.filter((r) => r.status === 'pending' && phaseById.get(r.phase_id)?.status !== 'in_progress');
    if (stale.length === 0) return;
    void (async () => {
      try {
        await (supabase as any)
          .from('phase_advance_proposals')
          .update({ status: 'superseded', decided_at: new Date().toISOString() })
          .in('id', stale.map((r) => r.id))
          .eq('status', 'pending');
        emit();
      } catch (e) { devWarn('[usePhaseAdvanceProposals] supersede failed', e); }
    })();
  }, [rows, plansReady, phaseById]);

  // Create a proposal when the evidence supports it and the student has none for this phase.
  useEffect(() => {
    if (!rows || !plansReady || !teacherId || isDemo()) return;
    const verdict = decidePhaseAdvanceProposal({
      currentPhase,
      metrics,
      metricsLoaded,
      proposalPhaseIds: new Set(rows.map((r) => r.phase_id)),
    });
    if (!verdict.create || !currentPhase || creating.current.has(currentPhase.id)) return;
    creating.current.add(currentPhase.id);
    const next = findNextPlannedPhase(phases, currentPhase);
    void (async () => {
      try {
        const { error } = await (supabase as any).from('phase_advance_proposals').insert({
          student_id: studentId,
          teacher_id: teacherId,
          phase_id: currentPhase.id,
          next_phase_id: next?.id ?? null,
          status: 'pending',
          evidence: verdict.evidence,
        });
        // 23505: another client created it first, which is the intended outcome.
        if (error && (error as any).code !== '23505') throw error;
        emit();
      } catch (e) {
        devWarn('[usePhaseAdvanceProposals] create failed', e);
      } finally {
        creating.current.delete(currentPhase.id);
      }
    })();
  }, [rows, plansReady, studentId, teacherId, currentPhase, phases, metrics, metricsLoaded]);

  const accept = async (proposal: PhaseAdvanceProposal) => {
    if (busy.current.has(proposal.id)) return;
    busy.current.add(proposal.id);
    let claimed = false;
    let phaseDone = false;
    try {
      const phase = phaseById.get(proposal.phase_id);
      if (!phase || phase.status !== 'in_progress') {
        toast.message('Proposal outdated', { description: 'That phase is no longer in progress.' });
        emit();
        return;
      }
      // Claim first: only a still pending row can be accepted (stale tab, double click).
      const { data: claimedRows, error: cErr } = await (supabase as any)
        .from('phase_advance_proposals')
        .update({ status: 'accepted', decided_at: new Date().toISOString(), decided_by: teacherId })
        .eq('id', proposal.id)
        .eq('status', 'pending')
        .select('id');
      if (cErr) throw cErr;
      if (!claimedRows || claimedRows.length === 0) {
        toast.message('Proposal already handled', { description: 'It was accepted, dismissed or replaced elsewhere.' });
        emit();
        return;
      }
      claimed = true;

      if (!(await updatePhase(proposal.phase_id, { status: 'done' }))) throw new Error('Could not mark the phase as done');
      phaseDone = true;
      const next = proposal.next_phase_id ? phaseById.get(proposal.next_phase_id) : null;
      if (next && next.status === 'planned') {
        if (!(await updatePhase(next.id, { status: 'in_progress' }))) throw new Error('Could not start the next phase');
      }
      toast.success(next ? `Phase done. "${next.title}" is now in progress.` : 'Phase marked as done.');
      emit();
    } catch (e: any) {
      let rolledBack = true;
      if (phaseDone) rolledBack = await updatePhase(proposal.phase_id, { status: 'in_progress' });
      // Give the proposal back only when the phase is in progress again; otherwise keep the claim
      // so the next render does not offer a proposal for a phase that is already done.
      if (claimed && rolledBack) {
        await (supabase as any).from('phase_advance_proposals')
          .update({ status: 'pending', decided_at: null, decided_by: null })
          .eq('id', proposal.id).eq('status', 'accepted');
        emit();
      }
      toast.error('Failed to move to the next phase', { description: e?.message || 'Unknown error' });
    } finally {
      busy.current.delete(proposal.id);
    }
  };

  const dismiss = async (proposal: PhaseAdvanceProposal) => {
    try {
      const { data, error } = await (supabase as any)
        .from('phase_advance_proposals')
        .update({ status: 'dismissed', decided_at: new Date().toISOString(), decided_by: teacherId })
        .eq('id', proposal.id)
        .eq('status', 'pending')
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.message('Proposal already handled', { description: 'It was accepted, dismissed or replaced elsewhere.' });
      } else {
        toast.message('Proposal dismissed', { description: 'The phase stays in progress.' });
      }
      emit();
    } catch (e: any) {
      toast.error('Failed to dismiss', { description: e?.message || 'Unknown error' });
    }
  };

  return { proposals, phaseById, accept, dismiss, refetch: fetchRows };
};
