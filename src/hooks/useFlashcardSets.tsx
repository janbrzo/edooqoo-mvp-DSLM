import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FlashcardSet, CreateFlashcardSet } from '@/types/flashcards';
import { useDemoContext } from '@/contexts/DemoContext';

export const useFlashcardSets = (teacherId?: string, studentId?: string) => {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { isDemoMode, demoData } = useDemoContext();

  const fetchSets = async () => {
    if (!teacherId) {
      setLoading(false);
      return;
    }

    if (isDemoMode) {
      // Return demo data — no Supabase queries
      const demoSets = (demoData?.flashcardSets || [])
        .filter((fs: any) => !studentId || fs.student_id === studentId)
        .map((fs: any) => ({
          ...fs,
          student_name: demoData?.students?.find((s: any) => s.id === fs.student_id)?.name,
          cards_count: fs.cards?.length || 0,
          mastered_count: 0,
          study_sessions_count: 0,
          last_studied_at: null,
        }));
      setSets(demoSets);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      let query = supabase
        .from('flashcard_sets')
        .select(`
          *,
          student:students(name, native_language, student_email),
          teacher:profiles!flashcard_sets_teacher_id_fkey(first_name, last_name),
          cards:flashcard_cards(id),
          progress:flashcard_progress(
            card_id,
            repetition,
            last_reviewed_at,
            learner_identifier
          )
        `)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedSets = data.map((set: any) => {
        // Calculate stats from progress data
        const progressRecords = set.progress || [];
        const uniqueLearners = new Set(progressRecords.map((p: any) => p.learner_identifier));
        
        // Mastered count: cards with repetition >= 4
        const masteredCount = progressRecords.filter((p: any) => p.repetition >= 4).length;
        
        // Study sessions: unique dates when cards were reviewed
        const reviewDates = new Set(
          progressRecords
            .filter((p: any) => p.last_reviewed_at)
            .map((p: any) => new Date(p.last_reviewed_at).toDateString())
        );
        const studySessionsCount = reviewDates.size;
        
        // Last studied: most recent review timestamp
        const allReviewTimestamps = progressRecords
          .filter((p: any) => p.last_reviewed_at)
          .map((p: any) => new Date(p.last_reviewed_at).getTime());
        const lastStudiedAt = allReviewTimestamps.length > 0 
          ? new Date(Math.max(...allReviewTimestamps)).toISOString()
          : null;
        
        return {
          ...set,
          student_name: set.student?.name,
          student_native_language: set.student?.native_language,
          student_email: set.student?.student_email,
          teacher_name: set.teacher ? `${set.teacher.first_name || ''} ${set.teacher.last_name || ''}`.trim() : undefined,
          cards_count: set.cards?.length || 0,
          mastered_count: masteredCount,
          study_sessions_count: studySessionsCount,
          last_studied_at: lastStudiedAt,
        };
      });

      setSets(formattedSets);
    } catch (error: any) {
      console.error('Error fetching flashcard sets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load flashcard sets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSets();
  }, [teacherId, studentId]);

  const createSet = async (data: CreateFlashcardSet) => {
    if (!teacherId || isDemoMode) return null;

    try {
      const { data: newSet, error } = await supabase
        .from('flashcard_sets')
        .insert({
          teacher_id: teacherId,
          student_id: data.student_id,
          title: data.title,
          description: data.description,
          is_bidirectional: data.is_bidirectional ?? true,
          back_type: data.back_type ?? 'translation',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Flashcard set created successfully',
      });

      await fetchSets();
      return newSet;
    } catch (error: any) {
      console.error('Error creating flashcard set:', error);
      toast({
        title: 'Error',
        description: 'Failed to create flashcard set',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateSet = async (setId: string, updates: Partial<FlashcardSet>) => {
    if (isDemoMode) return;
    try {
      const { error } = await supabase
        .from('flashcard_sets')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', setId)
        .eq('teacher_id', teacherId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Flashcard set updated',
      });

      await fetchSets();
    } catch (error: any) {
      console.error('Error updating flashcard set:', error);
      toast({
        title: 'Error',
        description: 'Failed to update flashcard set',
        variant: 'destructive',
      });
    }
  };

  const deleteSet = async (setId: string) => {
    if (!teacherId || isDemoMode) return;

    try {
      const { error } = await supabase.rpc('soft_delete_flashcard_set', {
        p_set_id: setId,
        p_teacher_id: teacherId,
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Flashcard set deleted',
      });

      await fetchSets();
    } catch (error: any) {
      console.error('Error deleting flashcard set:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete flashcard set',
        variant: 'destructive',
      });
    }
  };

  const generateShareToken = async (setId: string) => {
    if (!teacherId || isDemoMode) return null;

    try {
      const { data, error } = await supabase.rpc('generate_flashcard_share_token', {
        p_set_id: setId,
        p_teacher_id: teacherId,
        p_expires_hours: 8760, // 1 year
      });

      if (error) throw error;

      await fetchSets();
      return data;
    } catch (error: any) {
      console.error('Error generating share token:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate share link',
        variant: 'destructive',
      });
      return null;
    }
  };

  return {
    sets,
    loading,
    createSet,
    updateSet,
    deleteSet,
    generateShareToken,
    refetch: fetchSets,
  };
};
