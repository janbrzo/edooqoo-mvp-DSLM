/**
 * Hook for fetching student learning profile data from Welcome Test
 * Used in DSLM Profile view for psychological traits and AI summary
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StudentProfile {
  id: string;
  student_id: string;
  teacher_id: string;
  motivation_type: string | null;
  anxiety_level: string | null;
  ambiguity_tolerance: string | null;
  error_attitude: string | null;
  feedback_preference: string | null;
  preferred_input_channel: string | null;
  preferred_activities: string[] | null;
  interest_topics: string[] | null;
  weekly_study_time: string | null;
  level_confidence: string | null;
  confidence_speaking: number | null;
  confidence_writing: number | null;
  confidence_listening: number | null;
  confidence_reading: number | null;
  confidence_presenting: number | null;
  confidence_small_talk: number | null;
  ai_summary: string | null;
  estimated_level: string | null;
  strongest_skill: string | null;
  weakest_skill: string | null;
  grammar_score: number | null;
  vocabulary_score: number | null;
  reading_score: number | null;
  writing_score: number | null;
  speaking_score: number | null;
  communication_score: number | null;
  raw_answers: any;
  created_at: string | null;
}

interface UseStudentProfileProps {
  studentId: string;
  teacherId: string;
}

export const useStudentProfile = ({ studentId, teacherId }: UseStudentProfileProps) => {
  return useQuery({
    queryKey: ['student-learning-profile', studentId, teacherId],
    queryFn: async (): Promise<StudentProfile | null> => {
      const { data, error } = await supabase
        .from('student_learning_profiles')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .maybeSingle();

      if (error) throw error;
      return data as StudentProfile | null;
    },
    enabled: !!studentId && !!teacherId,
    staleTime: 5 * 60 * 1000,
  });
};
