import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { toast } from '@/hooks/use-toast';
import { devLog, devWarn } from '@/utils/logger';
import { useDemoContext } from '@/contexts/DemoContext';
import { useAuthUser } from '@/hooks/useAuthUser';

type Student = Tables<'students'>;

export const useStudents = () => {
  const queryClient = useQueryClient();
  const { isDemoMode, demoData } = useDemoContext();
  const { data: user } = useAuthUser();
  const teacherId = user?.id;

  const studentsQuery = useQuery<Student[]>({
    queryKey: ['students', teacherId, isDemoMode, !!demoData],
    enabled: isDemoMode ? !!demoData : !!teacherId,
    queryFn: async () => {
      if (isDemoMode && demoData) {
        return demoData.students as unknown as Student[];
      }
      if (!teacherId) return [];
      devLog('📚 Fetching students...');
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const students = studentsQuery.data || [];
  // v6.9.8 — in demo mode the query is disabled until demoData arrives; expose
  // a synthetic loading state so consumers (Dashboard / AllWorksheets) don't
  // treat "no students yet" as the empty state.
  const loading = (isDemoMode && !demoData) || studentsQuery.isLoading;

  const invalidate = useCallback((studentId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['students'] });
    if (studentId) queryClient.invalidateQueries({ queryKey: ['student', studentId] });
  }, [queryClient]);

  const fetchStudents = useCallback(async () => {
    await studentsQuery.refetch();
  }, [studentsQuery]);

  const addStudent = async (
    name: string,
    englishLevel: string | null,
    mainGoal: string | null,
    studentEmail?: string,
    sendOverdueEmails: boolean = true,
    nativeLanguage: string = 'Spanish',
    mainGoalTargetDate?: string | null
  ) => {
    try {
      if (!user) throw new Error('User not authenticated');

      if (studentEmail) {
        const normalizedEmail = studentEmail.toLowerCase().trim();
        const { data: existing } = await supabase
          .from('students')
          .select('id')
          .eq('teacher_id', user.id)
          .ilike('student_email', normalizedEmail)
          .is('deleted_at', null)
          .maybeSingle();
        if (existing) {
          toast({ title: 'Error', description: 'A student with this email already exists.', variant: 'destructive' });
          throw new Error('Student with this email already exists');
        }
      }

      const { data, error } = await supabase
        .from('students')
        .insert([{
          name,
          english_level: englishLevel || null,
          main_goal: mainGoal || null,
          main_goal_target_date: mainGoalTargetDate || null,
          teacher_id: user.id,
          teacher_email: user.email,
          student_email: studentEmail?.toLowerCase().trim() || null,
          send_overdue_emails: sendOverdueEmails,
          native_language: nativeLanguage,
          // v4.8: bias new students slightly toward Scientific (input-heavy)
          // by initialising pacing at 30/100. Teacher can override at any time
          // and Auto AI Recalculate will refine once data is available.
          dslm_pacing_mode: 30,
        }])
        .select()
        .single();

      if (error) throw error;

      // v4.8: best-effort initial pacing recalculation (fire-and-forget, fail-silent).
      // Refines the default 30 once profile signals (goal, deadline, level) are available.
      try {
        supabase.functions.invoke('recalculate-pacing', {
          body: { studentId: data.id, teacherId: user.id },
        }).catch((e) => devWarn('[v4.8] Initial pacing calc failed', e));
      } catch (e) { devWarn('[v4.8] recalculate-pacing dispatch threw', e); }

      // Auto-generate permanent Google Meet link if setting is enabled and GCal is connected
      try {
        const { data: calSettings } = await supabase.from('calendar_settings')
          .select('auto_create_student_meeting_link').eq('teacher_id', user.id).maybeSingle();
        if ((calSettings as any)?.auto_create_student_meeting_link) {
          const { data: gcalToken } = await supabase.from('calendar_gcal_tokens')
            .select('id').eq('teacher_id', user.id).maybeSingle();
          if (gcalToken) {
            await supabase.functions.invoke('gcal-sync', {
              body: { teacherId: user.id, studentId: data.id, action: 'create_permanent_room', slotId: data.id },
            });
          }
        }
      } catch (_) {}

      invalidate(data.id);
      toast({ title: 'Success', description: 'Student added successfully' });
      return data;
    } catch (error: any) {
      console.error('Error adding student:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const updateStudent = async (
    id: string,
    updates: Partial<Pick<Student, 'name' | 'english_level' | 'main_goal' | 'student_email' | 'send_overdue_emails' | 'native_language' | 'main_goal_target_date'>>
  ) => {
    try {
      if (!user) throw new Error('User not authenticated');

      // v4.9 / v5.0: detect main_goal OR deadline change for pacing proposal trigger
      let goalChanged = false;
      let targetDateChanged = false;
      if (updates.main_goal !== undefined || updates.main_goal_target_date !== undefined) {
        const { data: prev } = await supabase
          .from('students').select('main_goal, main_goal_target_date').eq('id', id).maybeSingle();
        if (prev && updates.main_goal !== undefined && (prev as any).main_goal !== updates.main_goal) goalChanged = true;
        if (prev && updates.main_goal_target_date !== undefined && (prev as any).main_goal_target_date !== updates.main_goal_target_date) targetDateChanged = true;
      }

      const { data, error } = await supabase
        .from('students')
        .update({ ...updates, teacher_email: user.email })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // v5.2: trigger pacing proposal (proposal mode — teacher must approve)
      // and surface the result via toast + event so the bell refreshes immediately.
      if (goalChanged || targetDateChanged) {
        (async () => {
          try {
            const { data: pacingRes, error: pacingErr } = await supabase.functions.invoke('recalculate-pacing', {
              body: {
                studentId: id,
                teacherId: user.id,
                mode: 'proposal',
                triggerType: 'goal_added',
                triggerDetails: {
                  newGoal: updates.main_goal,
                  newTargetDate: updates.main_goal_target_date,
                  changes: { goalChanged, targetDateChanged },
                },
              },
            });
            if (pacingErr) { devWarn('[v5.2] Goal-trigger pacing failed', pacingErr); return; }
            const result: any = pacingRes || {};
            if (result.proposalId) {
              window.dispatchEvent(new CustomEvent('pacingProposalChanged'));
              toast({
                title: 'Pacing review proposed',
                description: `${result.current ?? '?'} → ${result.proposed} — open the bell to accept or dismiss.`,
              });
            } else if (result.skipped) {
              toast({
                title: 'Pacing checked — no change needed',
                description: `Current ${result.current ?? '?'}/100 stays optimal (${result.skipReason || 'no significant change'}).`,
              });
            }
          } catch (e) { devWarn('[v5.2] Goal-trigger dispatch threw', e); }
        })();
      }

      invalidate(id);
      toast({ title: 'Success', description: 'Student updated successfully' });
      return data;
    } catch (error: any) {
      console.error('Error updating student:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      throw error;
    }
  };

  const updateStudentActivity = useCallback(async (studentId: string) => {
    try {
      devLog('🔄 UPDATING STUDENT ACTIVITY for:', studentId);
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('students')
        .update({ updated_at: new Date().toISOString(), teacher_email: user.email })
        .eq('id', studentId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) throw error;
      devLog('✅ Student activity updated successfully:', data);

      setTimeout(() => { invalidate(studentId); }, 1000);
      return data;
    } catch (error: any) {
      console.error('❌ Error updating student activity:', error);
      throw error;
    }
  }, [user, invalidate]);

  const deleteStudent = async (studentId: string) => {
    try {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.rpc('soft_delete_student', {
        p_student_id: studentId,
        p_teacher_id: user.id,
      });

      if (error) throw error;

      invalidate(studentId);
      toast({ title: 'Success', description: 'Student deleted successfully' });
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting student:', error);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return { success: false, error: error.message };
    }
  };

  // Listen for cross-component "studentUpdated" events
  useEffect(() => {
    const handleStudentUpdate = async (event: CustomEvent) => {
      devLog('🎯 RECEIVED studentUpdated event:', event.detail);
      const { studentId } = event.detail;
      if (studentId) await updateStudentActivity(studentId);
    };
    window.addEventListener('studentUpdated', handleStudentUpdate as EventListener);
    return () => window.removeEventListener('studentUpdated', handleStudentUpdate as EventListener);
  }, [updateStudentActivity]);

  return {
    students,
    loading,
    addStudent,
    updateStudent,
    updateStudentActivity,
    deleteStudent,
    refetch: fetchStudents,
  };
};
