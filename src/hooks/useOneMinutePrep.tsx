import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { StudentKnowledgeEntry } from '@/types/studentKnowledge';

const isValidUUID = (uuid: string): boolean => {
  if (!uuid) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
};

export interface OneMinutePrepData {
  personalHooks: StudentKnowledgeEntry[];
  topWeaknesses: StudentKnowledgeEntry[];
  lessonIdeas: StudentKnowledgeEntry[];
}

/**
 * v6.9.8 — 1-Minute Prep digest.
 * Pulls the 3 most actionable signals per category from `student_knowledge_entries`
 * so a teacher can plan the next lesson in ~60 seconds.
 * - personalHooks: latest Personal entries (last 30 days)
 * - topWeaknesses: Skill Assessment entries with metadata.skill_subtype in (weakness, mistake, practice)
 * - lessonIdeas: Next Lesson Ideas not yet archived/used in a worksheet
 */
export const useOneMinutePrep = (studentId: string, teacherId: string) => {
  const enabled = isValidUUID(studentId) && isValidUUID(teacherId);

  return useQuery<OneMinutePrepData>({
    queryKey: ['one-minute-prep', studentId, teacherId],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const base = supabase
        .from('student_knowledge_entries')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null)
        .eq('is_outdated', false);

      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

      const [personal, skill, ideas] = await Promise.all([
        base.eq('category', 'Personal').gte('created_at', since).order('created_at', { ascending: false }).limit(3),
        // Skill Assessment — order by recency; client filters subtype
        supabase.from('student_knowledge_entries')
          .select('*')
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .is('deleted_at', null)
          .eq('is_outdated', false)
          .eq('category', 'Skill Assessment')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('student_knowledge_entries')
          .select('*')
          .eq('student_id', studentId)
          .eq('teacher_id', teacherId)
          .is('deleted_at', null)
          .eq('is_outdated', false)
          .eq('category', 'Next Lesson Ideas')
          .is('archived_at' as any, null)
          .is('used_in_worksheet_id' as any, null)
          .order('created_at', { ascending: false })
          .limit(3),
      ]);

      const skillRows = ((skill.data || []) as StudentKnowledgeEntry[]).filter((e) => {
        const sub = (e.metadata as any)?.skill_subtype;
        return sub === 'weakness' || sub === 'mistake' || sub === 'practice';
      }).slice(0, 3);

      return {
        personalHooks: (personal.data || []) as StudentKnowledgeEntry[],
        topWeaknesses: skillRows,
        lessonIdeas: (ideas.data || []) as StudentKnowledgeEntry[],
      };
    },
  });
};