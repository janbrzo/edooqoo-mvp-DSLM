// v6.9.68 P4 — Aggregates "needs review" signals for a single student so
// the DSLM sidebar can show subtle attention dots in logically-located spots.
// Sources: pending Welcome Test goal suggestions, pending pacing proposals,
// and a level-suggestion banner that hasn't been dismissed.
//
// This hook stays read-only and reuses existing tables; it does NOT mutate
// curriculum, worksheet generation, or any other educational data path.
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StudentAttentionDots {
  goalsAny: boolean;
  supporting: boolean;
  additional: boolean;
  pathway: boolean; // pacing or level
  flashcards: boolean; // student-added cards
  homework: boolean; // submitted, not reviewed
}

const EMPTY: StudentAttentionDots = {
  goalsAny: false,
  supporting: false,
  additional: false,
  pathway: false,
  flashcards: false,
  homework: false,
};

export function useStudentAttentionDots(studentId?: string, teacherId?: string, currentLevel?: string | null) {
  const [dots, setDots] = useState<StudentAttentionDots>(EMPTY);

  useEffect(() => {
    if (!studentId || !teacherId) { setDots(EMPTY); return; }
    let cancelled = false;
    (async () => {
      try {
        const [goals, pacing, lp, hw, flashSets] = await Promise.all([
          supabase.from('student_progress_goals')
            .select('id, goal_type, source, accepted_at, archived_at, is_achieved, deleted_at')
            .eq('student_id', studentId).eq('teacher_id', teacherId).is('deleted_at', null),
          supabase.from('pacing_proposals')
            .select('id, status').eq('student_id', studentId).eq('teacher_id', teacherId).eq('status', 'pending'),
          supabase.from('student_learning_profiles')
            .select('estimated_level, updated_at').eq('student_id', studentId)
            .not('estimated_level', 'is', null).order('updated_at', { ascending: false }).limit(1),
          supabase.from('homework_assignments')
            .select('id, completed_at, reviewed_at').eq('student_id', studentId).eq('teacher_id', teacherId),
          supabase.from('flashcard_sets')
            .select('id').eq('student_id', studentId).eq('teacher_id', teacherId).is('deleted_at', null),
        ]);

        if (cancelled) return;

        const goalsRows = (goals.data || []).filter((g: any) =>
          g.source === 'welcome_test_auto' && !g.accepted_at && !g.archived_at && !g.is_achieved
        );
        const supporting = goalsRows.some((g: any) => g.goal_type === 'supporting');
        const additional = goalsRows.some((g: any) => g.goal_type === 'additional');
        const goalsAny = goalsRows.length > 0;

        const pacingPending = (pacing.data?.length ?? 0) > 0;
        const estimated = (lp.data || [])[0]?.estimated_level as string | undefined;
        let levelSuggested = false;
        if (estimated && currentLevel && estimated !== currentLevel) {
          try {
            levelSuggested = sessionStorage.getItem(`wt-level-change-dismissed:student:${studentId}`) !== '1';
          } catch { levelSuggested = true; }
        }
        const pathway = pacingPending || levelSuggested;

        const homework = (hw.data || []).some((h: any) => !!h.completed_at && !h.reviewed_at);

        // Student-added flashcards: count any card with created_by_student=true
        // within the teacher's sets for this student.
        let flashcards = false;
        const setIds = (flashSets.data || []).map((s: any) => s.id);
        if (setIds.length > 0) {
          const { count } = await supabase
            .from('flashcard_cards')
            .select('id', { count: 'exact', head: true })
            .in('set_id', setIds)
            .eq('created_by_student', true)
            .is('deleted_at', null);
          flashcards = (count ?? 0) > 0;
        }

        setDots({ goalsAny, supporting, additional, pathway, flashcards, homework });
      } catch (err) {
        console.warn('[useStudentAttentionDots] failed', err);
        setDots(EMPTY);
      }
    })();
    return () => { cancelled = true; };
  }, [studentId, teacherId, currentLevel]);

  return useMemo(() => dots, [dots]);
}