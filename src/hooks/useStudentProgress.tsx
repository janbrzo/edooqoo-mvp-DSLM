/**
 * Hook for managing student progress goals and learning elements
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ProgressGoal, LearningElement, GoalType, ElementType, ElementSource } from '@/types/studentProgress';
import { devLog, devWarn } from '@/utils/logger';

interface UseStudentProgressProps {
  studentId: string;
  teacherId: string;
}

export const useStudentProgress = ({ studentId, teacherId }: UseStudentProgressProps) => {
  const [goals, setGoals] = useState<ProgressGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!studentId || !teacherId) {
      setGoals([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('student_progress_goals')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true });

      if (goalsError) throw goalsError;

      // Fetch elements for all goals
      const { data: elementsData, error: elementsError } = await supabase
        .from('student_learning_elements')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .order('display_order', { ascending: true });

      if (elementsError) throw elementsError;

      // Merge elements into goals
      const goalsWithElements: ProgressGoal[] = (goalsData || []).map(goal => ({
        ...goal,
        elements: (elementsData || []).filter(el => el.goal_id === goal.id)
      }));

      setGoals(goalsWithElements);
    } catch (error) {
      console.error('Error fetching student progress:', error);
      toast.error('Failed to load progress data');
    } finally {
      setLoading(false);
    }
  }, [studentId, teacherId]);

  useEffect(() => {
    const handler = () => fetchGoals();
    window.addEventListener("student-progress:refresh", handler);
    return () => window.removeEventListener("student-progress:refresh", handler);
  }, [fetchGoals]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  // Add a new goal
  const addGoal = async (
    goalType: GoalType,
    title: string,
    description?: string,
    targetDate?: string
  ): Promise<ProgressGoal | null> => {
    try {
      const maxOrder = goals.length > 0 ? Math.max(...goals.map(g => g.display_order)) : -1;
      
      const { data, error } = await supabase
        .from('student_progress_goals')
        .insert({
          student_id: studentId,
          teacher_id: teacherId,
          goal_type: goalType,
          title,
          description: description || null,
          target_date: targetDate || null,
          display_order: maxOrder + 1
        })
        .select()
        .single();

      if (error) throw error;

      const newGoal: ProgressGoal = { ...data, elements: [] };
      setGoals(prev => [...prev, newGoal]);
      toast.success('Goal added successfully');

      // v5.1: trigger pacing proposal — and surface the result to the teacher.
      if (targetDate) {
        (async () => {
          try {
            const { data, error } = await supabase.functions.invoke('recalculate-pacing', {
              body: {
                studentId,
                teacherId,
                mode: 'proposal',
                triggerType: 'goal_added',
                triggerDetails: { action: 'goal_added', goalType, title, targetDate },
              },
            });
            devLog('[v5.1] recalculate-pacing (addGoal) result', { data, error });
            if (error) return;
            const result: any = data || {};
            if (result.proposalId) {
              window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
              toast.message('Pacing review proposed', {
                description: `${result.current ?? '?'} → ${result.proposed} — open the bell to accept or dismiss.`,
              });
            } else if (result.skipped) {
              toast.message('Pacing checked — no change needed', {
                description: `Current ${result.current ?? '?'}/100 stays optimal (${result.skipReason || 'no significant change'}).`,
              });
            }
          } catch (e) { devWarn('[v5.1] Goal-add pacing failed', e); }
        })();
      }

      return newGoal;
    } catch (error) {
      console.error('Error adding goal:', error);
      toast.error('Failed to add goal');
      return null;
    }
  };

  // Update a goal
  const updateGoal = async (
    goalId: string,
    updates: Partial<Pick<ProgressGoal, 'title' | 'description' | 'target_date' | 'is_achieved'>> & {
      manual_progress_pct?: number | null;
      archived_at?: string | null;
      accepted_at?: string | null;
    }
  ): Promise<boolean> => {
    try {
      const updateData: any = { ...updates };
      if (updates.is_achieved) {
        updateData.achieved_at = new Date().toISOString();
      }

      // v5.0: detect deadline / achieved change for pacing trigger
      const prev = goals.find(g => g.id === goalId);
      const targetDateChanged =
        Object.prototype.hasOwnProperty.call(updates, 'target_date') &&
        (prev?.target_date || null) !== (updates.target_date || null);
      const achievedChanged =
        Object.prototype.hasOwnProperty.call(updates, 'is_achieved') &&
        prev?.is_achieved !== updates.is_achieved;

      const { error } = await supabase
        .from('student_progress_goals')
        .update(updateData)
        .eq('id', goalId)
        .eq('teacher_id', teacherId);

      if (error) throw error;

      setGoals(prev => prev.map(g => 
        g.id === goalId ? { ...g, ...updates } : g
      ));
      toast.success('Goal updated');

      // v5.1: trigger pacing proposal on deadline/achievement change.
      if (targetDateChanged || achievedChanged) {
        (async () => {
          try {
            const { data, error } = await supabase.functions.invoke('recalculate-pacing', {
              body: {
                studentId,
                teacherId,
                mode: 'proposal',
                triggerType: 'goal_added',
                triggerDetails: {
                  action: achievedChanged ? 'goal_updated_achievement' : 'goal_updated_deadline',
                  goalId,
                  title: prev?.title,
                  targetDate: updates.target_date ?? null,
                  isAchieved: updates.is_achieved ?? null,
                },
              },
            });
            devLog('[v5.1] recalculate-pacing (updateGoal) result', { data, error });
            if (error) return;
            const result: any = data || {};
            if (result.proposalId) {
              window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
              toast.message('Pacing review proposed', {
                description: `${result.current ?? '?'} → ${result.proposed} — open the bell to accept or dismiss.`,
              });
            } else if (result.skipped) {
              toast.message('Pacing checked — no change needed', {
                description: `Current ${result.current ?? '?'}/100 stays optimal (${result.skipReason || 'no significant change'}).`,
              });
            }
          } catch (e) { devWarn('[v5.1] Goal-trigger pacing failed', e); }
        })();
      }

      return true;
    } catch (error) {
      console.error('Error updating goal:', error);
      toast.error('Failed to update goal');
      return false;
    }
  };

  // Delete a goal (soft delete)
  const deleteGoal = async (goalId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('student_progress_goals')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', goalId)
        .eq('teacher_id', teacherId);

      if (error) throw error;

      setGoals(prev => prev.filter(g => g.id !== goalId));
      toast.success('Goal deleted');
      return true;
    } catch (error) {
      console.error('Error deleting goal:', error);
      toast.error('Failed to delete goal');
      return false;
    }
  };

  // v5.0: archive / unarchive (different from soft-delete — kept visible in dedicated section).
  const archiveGoal = async (goalId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('student_progress_goals')
        .update({ archived_at: new Date().toISOString() } as any)
        .eq('id', goalId)
        .eq('teacher_id', teacherId);
      if (error) throw error;
      setGoals(prev => prev.map(g => g.id === goalId ? ({ ...g, archived_at: new Date().toISOString() } as any) : g));
      toast.success('Goal archived');
      return true;
    } catch (error) {
      console.error('Error archiving goal:', error);
      toast.error('Failed to archive goal');
      return false;
    }
  };

  const unarchiveGoal = async (goalId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('student_progress_goals')
        .update({ archived_at: null } as any)
        .eq('id', goalId)
        .eq('teacher_id', teacherId);
      if (error) throw error;
      setGoals(prev => prev.map(g => g.id === goalId ? ({ ...g, archived_at: null } as any) : g));
      toast.success('Goal restored');
      return true;
    } catch (error) {
      console.error('Error unarchiving goal:', error);
      toast.error('Failed to restore goal');
      return false;
    }
  };

  // Add a learning element
  const addElement = async (
    goalId: string,
    elementType: ElementType,
    title: string,
    description?: string,
    source: ElementSource = 'manual'
  ): Promise<LearningElement | null> => {
    try {
      const goal = goals.find(g => g.id === goalId);
      const maxOrder = goal?.elements?.length ? Math.max(...goal.elements.map(e => e.display_order)) : -1;

      const { data, error } = await supabase
        .from('student_learning_elements')
        .insert({
          goal_id: goalId,
          student_id: studentId,
          teacher_id: teacherId,
          element_type: elementType,
          title,
          description: description || null,
          source,
          display_order: maxOrder + 1
        })
        .select()
        .single();

      if (error) throw error;

      setGoals(prev => prev.map(g => 
        g.id === goalId 
          ? { ...g, elements: [...(g.elements || []), data] }
          : g
      ));
      
      return data;
    } catch (error) {
      console.error('Error adding element:', error);
      toast.error('Failed to add learning element');
      return null;
    }
  };

  // Add multiple elements (for AI generation)
  const addElements = async (
    goalId: string,
    elements: Array<{ element_type: ElementType; title: string; description?: string }>
  ): Promise<boolean> => {
    try {
      const goal = goals.find(g => g.id === goalId);
      const startOrder = goal?.elements?.length ? Math.max(...goal.elements.map(e => e.display_order)) + 1 : 0;

      const insertData = elements.map((el, idx) => ({
        goal_id: goalId,
        student_id: studentId,
        teacher_id: teacherId,
        element_type: el.element_type,
        title: el.title,
        description: el.description || null,
        source: 'ai_generated' as ElementSource,
        display_order: startOrder + idx
      }));

      const { data, error } = await supabase
        .from('student_learning_elements')
        .insert(insertData)
        .select();

      if (error) throw error;

      setGoals(prev => prev.map(g => 
        g.id === goalId 
          ? { ...g, elements: [...(g.elements || []), ...(data || [])] }
          : g
      ));
      
      toast.success(`Added ${elements.length} learning elements`);
      return true;
    } catch (error) {
      console.error('Error adding elements:', error);
      toast.error('Failed to add learning elements');
      return false;
    }
  };

  // Update element rating
  const updateElementRating = async (
    elementId: string,
    rating: number
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('student_learning_elements')
        .update({ 
          current_rating: rating,
          last_rated_at: new Date().toISOString()
        })
        .eq('id', elementId)
        .eq('teacher_id', teacherId);

      if (error) throw error;

      setGoals(prev => prev.map(g => ({
        ...g,
        elements: g.elements?.map(el => 
          el.id === elementId 
            ? { ...el, current_rating: rating, last_rated_at: new Date().toISOString() }
            : el
        )
      })));
      
      return true;
    } catch (error) {
      console.error('Error updating rating:', error);
      toast.error('Failed to update rating');
      return false;
    }
  };

  // Delete element (soft delete)
  const deleteElement = async (elementId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('student_learning_elements')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', elementId)
        .eq('teacher_id', teacherId);

      if (error) throw error;

      setGoals(prev => prev.map(g => ({
        ...g,
        elements: g.elements?.filter(el => el.id !== elementId)
      })));
      
      toast.success('Element deleted');
      return true;
    } catch (error) {
      console.error('Error deleting element:', error);
      toast.error('Failed to delete element');
      return false;
    }
  };

  // Calculate overall progress
  const getProgressStats = useCallback(() => {
    const allElements = goals.flatMap(g => g.elements || []);
    const ratedElements = allElements.filter(el => el.current_rating !== null);
    const totalElements = allElements.length;
    const masteredElements = ratedElements.filter(el => el.current_rating === 5).length;
    const averageRating = ratedElements.length > 0
      ? ratedElements.reduce((sum, el) => sum + (el.current_rating || 0), 0) / ratedElements.length
      : 0;

    return {
      totalGoals: goals.length,
      achievedGoals: goals.filter(g => g.is_achieved).length,
      totalElements,
      ratedElements: ratedElements.length,
      masteredElements,
      averageRating: Math.round(averageRating * 10) / 10,
      progressPercentage: totalElements > 0 
        ? Math.round((masteredElements / totalElements) * 100) 
        : 0
    };
  }, [goals]);

  return {
    goals,
    loading,
    refetch: fetchGoals,
    addGoal,
    updateGoal,
    deleteGoal,
    archiveGoal,
    unarchiveGoal,
    addElement,
    addElements,
    updateElementRating,
    deleteElement,
    getProgressStats
  };
};
