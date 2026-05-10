/**
 * useCurriculumPhases — DSLM Pathway v3 (Macro Timeline)
 * Manages curriculum phases (macro learning blocks) for a student.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type PhaseStatus = 'done' | 'in_progress' | 'planned' | 'draft';

export interface CurriculumPhase {
  id: string;
  student_id: string;
  teacher_id: string;
  sequence_number: number;
  title: string;
  description: string | null;
  status: PhaseStatus;
  estimated_weeks_start: number | null;
  estimated_weeks_end: number | null;
  focus_areas: string[];
  rationale: string | null;
  generation_context: any;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface UseCurriculumPhasesProps {
  studentId: string;
  teacherId: string;
}

export const useCurriculumPhases = ({ studentId, teacherId }: UseCurriculumPhasesProps) => {
  const [phases, setPhases] = useState<CurriculumPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchPhases = useCallback(async () => {
    if (!studentId || !teacherId) {
      setPhases([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dslm_curriculum_phases')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .order('sequence_number', { ascending: true });
      if (error) throw error;
      setPhases((data || []) as CurriculumPhase[]);
    } catch (e) {
      console.error('Error fetching curriculum phases:', e);
    } finally {
      setLoading(false);
    }
  }, [studentId, teacherId]);

  useEffect(() => { fetchPhases(); }, [fetchPhases]);

  // v6.9.14 — cross-instance sync: when one hook generates phases,
  // other instances (e.g. PathwayView vs MacroTimeline) refetch.
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.studentId === studentId) fetchPhases();
    };
    window.addEventListener('dslm:phasesUpdated', h);
    return () => window.removeEventListener('dslm:phasesUpdated', h);
  }, [studentId, fetchPhases]);

  const generatePhases = async (
    mode: 'replace' | 'add' = 'replace',
    opts: { count?: number; teacherComment?: string } = {}
  ): Promise<boolean> => {
    try {
      setGenerating(true);
      const response = await supabase.functions.invoke('generate-curriculum-phases', {
        body: { studentId, teacherId, mode, count: opts.count, teacherComment: opts.teacherComment ?? '' }
      });
      if (response.error) throw response.error;
      const newPhases = response.data?.phases || [];
      if (newPhases.length === 0) {
        toast.info('No phases generated. Add more goals or notes first.');
        return false;
      }
      await fetchPhases();
      window.dispatchEvent(new CustomEvent('dslm:phasesUpdated', { detail: { studentId } }));
      toast.success(`Generated ${newPhases.length} curriculum phases`);
      return true;
    } catch (e: any) {
      console.error('Error generating phases:', e);
      toast.error('Failed to generate curriculum plan');
      return false;
    } finally {
      setGenerating(false);
    }
  };

  const updatePhase = async (id: string, fields: Partial<Pick<CurriculumPhase, 'title' | 'description' | 'status' | 'estimated_weeks_start' | 'estimated_weeks_end' | 'focus_areas' | 'rationale'>>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('dslm_curriculum_phases')
        .update(fields)
        .eq('id', id)
        .eq('teacher_id', teacherId);
      if (error) throw error;
      setPhases(prev => prev.map(p => p.id === id ? { ...p, ...fields } as CurriculumPhase : p));
      return true;
    } catch (e) {
      console.error('Error updating phase:', e);
      toast.error('Failed to update phase');
      return false;
    }
  };

  const setPhaseStatus = (id: string, status: PhaseStatus) => updatePhase(id, { status });

  const deletePhase = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('dslm_curriculum_phases')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('teacher_id', teacherId);
      if (error) throw error;
      setPhases(prev => prev.filter(p => p.id !== id));
      toast.success('Phase removed');
      return true;
    } catch (e) {
      console.error('Error deleting phase:', e);
      toast.error('Failed to remove phase');
      return false;
    }
  };

  const addPhase = async (input: { title: string; description?: string; status?: PhaseStatus; estimated_weeks_start?: number; estimated_weeks_end?: number; focus_areas?: string[] }): Promise<CurriculumPhase | null> => {
    try {
      const maxSeq = phases.reduce((acc, p) => Math.max(acc, p.sequence_number), 0);
      const { data, error } = await supabase
        .from('dslm_curriculum_phases')
        .insert({
          student_id: studentId,
          teacher_id: teacherId,
          sequence_number: maxSeq + 1,
          title: input.title,
          description: input.description || null,
          status: input.status || 'planned',
          estimated_weeks_start: input.estimated_weeks_start ?? null,
          estimated_weeks_end: input.estimated_weeks_end ?? null,
          focus_areas: input.focus_areas || [],
        })
        .select()
        .single();
      if (error) throw error;
      const phase = data as CurriculumPhase;
      setPhases(prev => [...prev, phase]);
      toast.success('Phase added');
      return phase;
    } catch (e) {
      console.error('Error adding phase:', e);
      toast.error('Failed to add phase');
      return null;
    }
  };

  return {
    phases,
    loading,
    generating,
    refetch: fetchPhases,
    generatePhases,
    updatePhase,
    setPhaseStatus,
    deletePhase,
    addPhase,
  };
};
