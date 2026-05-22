/**
 * Hook for managing future worksheet suggestions timeline (DSLM Pathway v4.1)
 * Splits suggestions into next_steps (legacy free-floating) and phase_steps (phase-bound).
 * Also exposes usedSteps for displayIndex calculation (negative numbers for used items).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WorksheetSuggestion } from '@/types/studentProgress';

interface UseFutureTimelineProps {
  studentId: string;
  teacherId: string;
}

export type SuggestionKind = 'next_step' | 'phase_step';

interface ExtendedWorksheetSuggestion extends WorksheetSuggestion {
  suggested_additional_info?: string | null;
  suggested_grammar_focus?: string | null;
  suggested_exercise_focus_map?: Record<string, string> | null;
  suggestion_kind?: SuggestionKind;
  phase_id?: string | null;
  focus_skill_names?: string[] | null;
  difficulty_level?: string | null;
  estimated_impact?: any;
  generation_context?: any;
}

interface GenerateNextStepsOpts {
  mode: 'replace' | 'add';
  count?: number;
  teacherComment?: string;
  excludeIds?: string[];
  /** When provided, generated steps are bound to this phase (suggestion_kind='phase_step', phase_id=...). */
  phaseId?: string | null;
}

interface GeneratePhaseStepsOpts {
  count?: number;
  teacherComment?: string;
}

export const useFutureTimeline = ({ studentId, teacherId }: UseFutureTimelineProps) => {
  const [suggestions, setSuggestions] = useState<ExtendedWorksheetSuggestion[]>([]);
  const [usedSteps, setUsedSteps] = useState<ExtendedWorksheetSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    if (!studentId || !teacherId) {
      setSuggestions([]);
      setUsedSteps([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [activeRes, usedRes] = await Promise.all([
        supabase
          .from('future_worksheet_suggestions')
          .select('*')
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .is('deleted_at', null)
          .eq('is_used', false)
          .order('sequence_number', { ascending: true })
          .limit(40),
        supabase
          .from('future_worksheet_suggestions')
          .select('*')
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .is('deleted_at', null)
          .eq('is_used', true)
          .order('used_at', { ascending: false })
          .limit(30),
      ]);

      if (activeRes.error) throw activeRes.error;
      if (usedRes.error) throw usedRes.error;
      // Defense-in-depth: ensure every active suggestion has EXACTLY 8 exercises in UI,
      // even if older rows in DB were saved with fewer. Pads with safe defaults.
      const NO_MEDIA_DEFAULTS = ['reading','fill-in-blanks','multiple-choice','true-false','matching','dialogue','answer-questions','discussion'];
      const padded = (activeRes.data || []).map((row: any) => {
        const ex: string[] = Array.isArray(row.suggested_exercises) ? [...row.suggested_exercises] : [];
        if (ex.length >= 8) return row;
        for (const f of NO_MEDIA_DEFAULTS) {
          if (ex.length >= 8) break;
          if (!ex.includes(f)) ex.push(f);
        }
        return { ...row, suggested_exercises: ex };
      });
      setSuggestions(padded as any);
      setUsedSteps((usedRes.data || []) as any);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  }, [studentId, teacherId]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  // v6.9.15c — cross-instance refresh trigger. Emitted e.g. by `useCurriculumPhases.deletePhase`
  // after detaching phase-bound suggestions, so any mounted timeline reflects them as free steps.
  useEffect(() => {
    const h = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.studentId === studentId) fetchSuggestions();
    };
    window.addEventListener('dslm:suggestionsUpdated', h);
    return () => window.removeEventListener('dslm:suggestionsUpdated', h);
  }, [studentId, fetchSuggestions]);

  // Selectors
  const nextSteps = useMemo(
    () => suggestions.filter(s => (s.suggestion_kind ?? 'next_step') === 'next_step'),
    [suggestions]
  );
  const phaseSteps = useMemo(
    () => suggestions.filter(s => s.suggestion_kind === 'phase_step'),
    [suggestions]
  );

  // Generate NEXT STEPS (immediate worksheet suggestions).
  // If `phaseId` is provided, the steps are stored as phase_step + phase_id and replace targets
  // only suggestions of that phase. Otherwise behaves as before (next_step, no phase).
  const generateNextSteps = async (opts: GenerateNextStepsOpts): Promise<boolean> => {
    try {
      if (!studentId || !teacherId) {
        toast.error('Missing student or teacher context.');
        return false;
      }
      setGenerating(true);
      const targetPhaseId = opts.phaseId ?? null;
      const isPhaseBound = !!targetPhaseId;
      const requestedCount = opts.count ?? 3;
      // v6.9.14 — defensive: cap excludeIds payload (large UUID arrays caused 500s).
      const safeExcludeIds = (opts.excludeIds ?? []).slice(0, 25);

      const invokePayload = {
        studentId, teacherId,
        mode: isPhaseBound ? 'phase_steps' : 'next_steps',
        count: requestedCount,
        phaseId: targetPhaseId,
        teacherComment: opts.teacherComment ?? '',
        excludeIds: safeExcludeIds,
      };
      // v6.9.15c — single call only. The previous "phase-bound failed → retry as free step"
      // fallback silently changed user intent. Edge Function now performs its own retry
      // server-side (plain JSON output) and surfaces precise error metadata.
      const response = await supabase.functions.invoke('generate-timeline', { body: invokePayload });
      if (response.error) throw response.error;
      const rawSuggestions = response.data?.suggestions || [];
      const generationContext = response.data?.generationContext || {};
      // v6.9.15a — warn when AI returned fewer than requested (truncation / partial).
      if (generationContext?.warning && rawSuggestions.length > 0 && rawSuggestions.length < requestedCount) {
        toast.info(`AI returned only ${rawSuggestions.length}/${requestedCount} steps (${generationContext.warning}). Try a smaller count for full output.`);
      }
      // Defense in depth: enforce exact count on the client too.
      const newSuggestions = rawSuggestions.slice(0, requestedCount);
      if (newSuggestions.length === 0) {
        toast.info('No suggestions generated. Add more student data first.');
        return false;
      }

      // Replace mode: soft-delete existing UNUSED suggestions in scope (this phase, or all next_step).
      if (opts.mode === 'replace') {
        const q = supabase
          .from('future_worksheet_suggestions')
          .update({ deleted_at: new Date().toISOString() })
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .eq('is_used', false);
        if (isPhaseBound) {
          await q.eq('phase_id', targetPhaseId);
        } else {
          // Only delete legacy next_step (no phase) — never touch phase-bound items.
          await q.eq('suggestion_kind', 'next_step').is('phase_id', null);
        }
      }

      // Calc starting sequence within scope
      const scopeExisting = isPhaseBound
        ? phaseSteps.filter(s => s.phase_id === targetPhaseId)
        : nextSteps;
      const startSeq = opts.mode === 'add' && scopeExisting.length > 0
        ? Math.max(...scopeExisting.map(s => s.sequence_number)) + 1
        : 1;

      const insertData = newSuggestions.map((s: any, idx: number) => ({
        student_id: studentId,
        teacher_id: teacherId,
        sequence_number: startSeq + idx,
        suggested_topic: s.topic,
        suggested_goal: s.goal || null,
        suggested_additional_info: s.additionalInfo || null,
        suggested_grammar_focus: s.grammarFocus || null,
        suggested_exercises: s.exercises,
        suggested_exercise_focus_map: s.exerciseFocusMap || {},
        rationale: s.rationale,
        source: 'ai_generated',
        suggestion_kind: isPhaseBound ? 'phase_step' : 'next_step',
        phase_id: targetPhaseId,
        focus_skill_names: s.focusSkills || [],
        difficulty_level: s.difficulty || null,
        estimated_impact: s.estimatedImpact || {},
        generation_context: generationContext
      }));

      const { error } = await supabase.from('future_worksheet_suggestions').insert(insertData);
      if (error) throw error;
      await fetchSuggestions();
      const label = isPhaseBound ? 'phase step' : 'next step';
      toast.success(`Generated ${newSuggestions.length} ${label}${newSuggestions.length > 1 ? 's' : ''}`);
      return true;
    } catch (error) {
      console.error('Error generating next steps:', error);
      // v6.9.11: distinguish gateway 402 (no credits) / 429 (rate limit) / generic 5xx.
      const status = (error as any)?.context?.status ?? (error as any)?.status;
      if (status === 402) {
        toast.error('AI credits exhausted. Add credits in Workspace settings.');
      } else if (status === 429) {
        toast.error('Too many AI requests. Wait a moment and retry.');
      } else if (status === 502) {
        // v6.9.15b — distinguish AI schema rejection (Gemini "too many states")
        // from generic gateway failures so the teacher sees actionable copy.
        const reqCount = opts.count ?? 3;
        const ctx: any = (error as any)?.context;
        const detail = String(ctx?.body?.detail || ctx?.detail || (error as any)?.message || '');
        const schemaRejected = ctx?.body?.schemaRejected === true || /too many states|INVALID_ARGUMENT|schema/i.test(detail);
        if (schemaRejected) {
          toast.error(
            'AI could not return this batch. Try generating fewer steps, or generate one step at a time.',
            { duration: 8000 }
          );
        } else {
          toast.error(
            reqCount > 1
              ? 'AI generator overloaded for batch requests — try generating 1 step at a time.'
              : 'AI generator is temporarily unavailable. Please retry in a moment.',
            { duration: 7000 }
          );
        }
      } else if (status === 500) {
        toast.error(
          'Generator returned an error. Try without phase target, or reduce existing steps and retry.',
          { duration: 7000 }
        );
      } else {
        toast.error('Failed to generate next steps. Please try again.');
      }
      return false;
    } finally {
      setGenerating(false);
    }
  };

  // Generate PHASE STEPS (worksheets bound to a curriculum phase)
  const generatePhaseSteps = async (phaseId: string, opts: GeneratePhaseStepsOpts = {}): Promise<boolean> => {
    return generateNextSteps({ mode: 'add', count: opts.count ?? 3, teacherComment: opts.teacherComment, phaseId });
  };

  // Backward-compatible alias
  const generateTimeline = async (mode: 'replace' | 'add' = 'replace'): Promise<boolean> =>
    generateNextSteps({ mode, count: 3 });

  const updateSuggestion = async (
    suggestionId: string,
    topic: string,
    goal?: string,
    additionalInfo?: string,
    grammarFocus?: string,
    exercises?: string[],
    exerciseFocusMap?: Record<string, string>,
  ): Promise<boolean> => {
    try {
      const updateData: any = { suggested_topic: topic, suggested_goal: goal || null };
      if (additionalInfo !== undefined) updateData.suggested_additional_info = additionalInfo || null;
      if (grammarFocus !== undefined) updateData.suggested_grammar_focus = grammarFocus || null;
      if (exercises !== undefined) updateData.suggested_exercises = exercises;
      if (exerciseFocusMap !== undefined) updateData.suggested_exercise_focus_map = exerciseFocusMap;

      const { error } = await supabase
        .from('future_worksheet_suggestions')
        .update(updateData)
        .eq('id', suggestionId)
        .eq('teacher_id', teacherId);
      if (error) throw error;

      setSuggestions(prev => prev.map(s =>
        s.id === suggestionId
          ? { ...s, suggested_topic: topic, suggested_goal: goal || null,
              ...(additionalInfo !== undefined && { suggested_additional_info: additionalInfo || null }),
              ...(grammarFocus !== undefined && { suggested_grammar_focus: grammarFocus || null }),
              ...(exercises !== undefined && { suggested_exercises: exercises }),
              ...(exerciseFocusMap !== undefined && { suggested_exercise_focus_map: exerciseFocusMap }),
            }
          : s
      ));
      toast.success('Suggestion updated');
      return true;
    } catch (error) {
      console.error('Error updating suggestion:', error);
      toast.error('Failed to update suggestion');
      return false;
    }
  };

  /**
   * v4.2: Regenerate ONE suggestion in-place — preserves its sequence_number and phase scope,
   * so the new step replaces the old one at the same visual position.
   */
  const regenerateInPlace = async (suggestionId: string, teacherComment: string): Promise<boolean> => {
    try {
      setGenerating(true);
      const original = suggestions.find(s => s.id === suggestionId);
      if (!original) {
        toast.error('Suggestion not found');
        return false;
      }
      const originalSeq = original.sequence_number;
      const originalPhaseId = original.phase_id ?? null;
      const isPhaseBound = !!originalPhaseId;

      // Soft-delete the original
      const { error: delErr } = await supabase
        .from('future_worksheet_suggestions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', suggestionId)
        .eq('teacher_id', teacherId);
      if (delErr) throw delErr;

      // Generate ONE replacement
      const response = await supabase.functions.invoke('generate-timeline', {
        body: {
          studentId, teacherId,
          mode: isPhaseBound ? 'phase_steps' : 'next_steps',
          count: 1,
          phaseId: originalPhaseId,
          teacherComment: teacherComment || '',
          excludeIds: [suggestionId],
        }
      });
      if (response.error) throw response.error;
      const raw = response.data?.suggestions || [];
      const generationContext = response.data?.generationContext || {};
      if (raw.length === 0) {
        toast.info('AI returned no replacement; original removed.');
        await fetchSuggestions();
        return false;
      }
      const s = raw[0];
      const { error: insErr } = await supabase
        .from('future_worksheet_suggestions')
        .insert({
          student_id: studentId,
          teacher_id: teacherId,
          sequence_number: originalSeq,
          suggested_topic: s.topic,
          suggested_goal: s.goal || null,
          suggested_additional_info: s.additionalInfo || null,
          suggested_grammar_focus: s.grammarFocus || null,
          suggested_exercises: s.exercises,
          suggested_exercise_focus_map: s.exerciseFocusMap || {},
          rationale: s.rationale,
          source: 'ai_generated',
          suggestion_kind: isPhaseBound ? 'phase_step' : 'next_step',
          phase_id: originalPhaseId,
          focus_skill_names: s.focusSkills || [],
          difficulty_level: s.difficulty || null,
          estimated_impact: s.estimatedImpact || {},
          generation_context: generationContext,
        });
      if (insErr) throw insErr;
      await fetchSuggestions();
      toast.success('Step regenerated');
      return true;
    } catch (error) {
      console.error('Error regenerating in place:', error);
      toast.error('Failed to regenerate step');
      return false;
    } finally {
      setGenerating(false);
    }
  };

  /**
   * v4.8: accepts worksheetId === null for "Mark as already used" (manual flag, no link).
   * Refetches usedSteps so the new entry shows up in the Used Steps section.
   */
  const useSuggestion = async (suggestionId: string, worksheetId: string | null): Promise<boolean> => {
    try {
      const update: any = { is_used: true, used_at: new Date().toISOString() };
      if (worksheetId) update.used_worksheet_id = worksheetId;
      const { error } = await supabase
        .from('future_worksheet_suggestions')
        .update(update)
        .eq('id', suggestionId)
        .eq('teacher_id', teacherId);
      if (error) throw error;
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      // Refresh usedSteps list so the marked item shows up immediately.
      fetchSuggestions();
      return true;
    } catch (error) {
      console.error('Error marking suggestion as used:', error);
      return false;
    }
  };

  /**
   * v5.0: restore a previously-used suggestion back to the active list.
   * Resets is_used / used_at / used_worksheet_id and assigns a fresh sequence_number
   * (max + 1) so the restored step lands at the end of the active queue.
   * The source worksheet (if any) is intentionally NOT deleted.
   */
  const restoreSuggestion = async (suggestionId: string): Promise<boolean> => {
    try {
      const target = usedSteps.find(s => s.id === suggestionId);
      if (!target) { toast.error('Used step not found'); return false; }
      const maxSeq = suggestions.length > 0 ? Math.max(...suggestions.map(s => s.sequence_number)) : 0;
      const { error } = await supabase
        .from('future_worksheet_suggestions')
        .update({
          is_used: false,
          used_at: null,
          used_worksheet_id: null,
          sequence_number: maxSeq + 1,
        })
        .eq('id', suggestionId)
        .eq('teacher_id', teacherId);
      if (error) throw error;
      await fetchSuggestions();
      toast.success('Step restored to active list');
      return true;
    } catch (error) {
      console.error('Error restoring suggestion:', error);
      toast.error('Failed to restore step');
      return false;
    }
  };

  // v4.8: cross-component refresh trigger (fired by useWorksheetGeneration after success).
  useEffect(() => {
    const handler = () => { fetchSuggestions(); };
    window.addEventListener('suggestionMarkedUsed', handler);
    return () => window.removeEventListener('suggestionMarkedUsed', handler);
  }, [fetchSuggestions]);

  const addSuggestion = async (
    topic: string,
    goal?: string,
    exercises?: string[],
    rationale?: string,
    exerciseFocusMap?: Record<string, string>
  ): Promise<ExtendedWorksheetSuggestion | null> => {
    try {
      const maxSeq = suggestions.length > 0 ? Math.max(...suggestions.map(s => s.sequence_number)) : 0;
      const { data, error } = await supabase
        .from('future_worksheet_suggestions')
        .insert({
          student_id: studentId, teacher_id: teacherId, sequence_number: maxSeq + 1,
          suggested_topic: topic, suggested_goal: goal || null,
          suggested_exercises: exercises || null, rationale: rationale || null,
          suggested_exercise_focus_map: exerciseFocusMap || {},
          source: 'manual', suggestion_kind: 'next_step',
        })
        .select().single();
      if (error) throw error;
      setSuggestions(prev => [...prev, data as any]);
      toast.success('Suggestion added');
      return data as any;
    } catch (error) {
      console.error('Error adding suggestion:', error);
      toast.error('Failed to add suggestion');
      return null;
    }
  };

  const deleteSuggestion = async (suggestionId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('future_worksheet_suggestions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', suggestionId)
        .eq('teacher_id', teacherId);
      if (error) throw error;
      setSuggestions(prev => prev.filter(s => s.id !== suggestionId));
      toast.success('Suggestion removed');
      return true;
    } catch (error) {
      console.error('Error deleting suggestion:', error);
      toast.error('Failed to remove suggestion');
      return false;
    }
  };

  return {
    suggestions,
    nextSteps,
    phaseSteps,
    usedSteps,
    loading,
    generating,
    refetch: fetchSuggestions,
    generateNextSteps,
    generatePhaseSteps,
    generateTimeline, // backward compat
    useSuggestion,
    addSuggestion,
    updateSuggestion,
    regenerateInPlace,
    deleteSuggestion,
    restoreSuggestion,
  };
};
