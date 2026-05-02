import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SkillMetric {
  id: string;
  student_id: string;
  teacher_id: string;
  skill_name: string;
  skill_category: string;
  current_mastery: number;
  trend: 'improving' | 'declining' | 'stable';
  total_events: number;
  last_event_at: string | null;
  first_event_at: string | null;
  mastery_history: Array<{ mastery: number; date: string }>;
  updated_at: string;
  micro_skill: string | null;
}

export interface CategoryMetric {
  category: string;
  avg_mastery: number;
  skill_count: number;
  total_events: number;
  trend: 'improving' | 'declining' | 'stable';
  last_activity: string | null;
}

export interface MicroSkillMetric {
  micro_skill: string;
  skill_category: string;
  avg_mastery: number;
  nano_skill_count: number;
  total_events: number;
  last_activity: string | null;
  trend: 'improving' | 'declining' | 'stable';
}

export function useSkillMetrics(studentId: string, teacherId: string, periodDays?: number | null) {
  const cutoffDate = periodDays
    ? new Date(Date.now() - periodDays * 86400000).toISOString()
    : null;

  const skillsQuery = useQuery({
    queryKey: ['skill-metrics', studentId, teacherId, periodDays],
    queryFn: async () => {
      let query = supabase
        .from('student_skill_metrics')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .order('current_mastery', { ascending: false });

      if (cutoffDate) {
        query = query.gte('last_event_at', cutoffDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(row => ({
        ...row,
        current_mastery: Number(row.current_mastery) || 0,
        total_events: Number(row.total_events) || 0,
        trend: (row.trend as 'improving' | 'declining' | 'stable') || 'stable',
        mastery_history: (row.mastery_history as any[] || []),
        micro_skill: (row as any).micro_skill || null,
      })) as SkillMetric[];
    },
    enabled: !!studentId && !!teacherId,
  });

  const categoriesQuery = useQuery({
    queryKey: ['category-metrics', studentId, teacherId, periodDays],
    queryFn: async () => {
      // For period filtering we recompute from skills data
      if (cutoffDate && skillsQuery.data) {
        const skills = skillsQuery.data.filter(s => !s.skill_name.startsWith('flashcard:'));
        const catMap: Record<string, { masteries: number[]; events: number; trends: string[]; lastActivity: string | null }> = {};
        for (const s of skills) {
          if (!catMap[s.skill_category]) {
            catMap[s.skill_category] = { masteries: [], events: 0, trends: [], lastActivity: null };
          }
          catMap[s.skill_category].masteries.push(s.current_mastery);
          catMap[s.skill_category].events += s.total_events;
          catMap[s.skill_category].trends.push(s.trend);
          if (!catMap[s.skill_category].lastActivity || (s.last_event_at && s.last_event_at > (catMap[s.skill_category].lastActivity || ''))) {
            catMap[s.skill_category].lastActivity = s.last_event_at;
          }
        }
        return Object.entries(catMap).map(([cat, d]) => ({
          category: cat,
          avg_mastery: Math.round(d.masteries.reduce((a, b) => a + b, 0) / d.masteries.length * 10) / 10,
          skill_count: d.masteries.length,
          total_events: d.events,
          trend: (d.trends.filter(t => t === 'improving').length > d.trends.filter(t => t === 'declining').length ? 'improving' : d.trends.filter(t => t === 'declining').length > d.trends.filter(t => t === 'improving').length ? 'declining' : 'stable') as 'improving' | 'declining' | 'stable',
          last_activity: d.lastActivity,
        })) as CategoryMetric[];
      }

      const { data, error } = await supabase
        .from('student_category_metrics')
        .select('*')
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId);

      if (error) throw error;
      return (data || []).map(row => ({
        category: row.category as string,
        avg_mastery: Number(row.avg_mastery) || 0,
        skill_count: Number(row.skill_count) || 0,
        total_events: Number(row.total_events) || 0,
        trend: (row.trend as 'improving' | 'declining' | 'stable') || 'stable',
        last_activity: row.last_activity as string | null,
      })) as CategoryMetric[];
    },
    enabled: !!studentId && !!teacherId,
  });

  // Micro skill metrics - computed from skills data
  const microSkills: MicroSkillMetric[] = React.useMemo(() => {
    if (!skillsQuery.data) return [];
    const map: Record<string, { masteries: number[]; events: number; trends: string[]; lastActivity: string | null; category: string }> = {};
    for (const s of skillsQuery.data) {
      if (!s.micro_skill || s.micro_skill === 'other' || s.micro_skill === 'flashcard') continue;
      if (!map[s.micro_skill]) {
        map[s.micro_skill] = { masteries: [], events: 0, trends: [], lastActivity: null, category: s.skill_category };
      }
      map[s.micro_skill].masteries.push(s.current_mastery);
      map[s.micro_skill].events += s.total_events;
      map[s.micro_skill].trends.push(s.trend);
      if (!map[s.micro_skill].lastActivity || (s.last_event_at && s.last_event_at > (map[s.micro_skill].lastActivity || ''))) {
        map[s.micro_skill].lastActivity = s.last_event_at;
      }
    }
    return Object.entries(map).map(([ms, d]) => ({
      micro_skill: ms,
      skill_category: d.category,
      avg_mastery: Math.round(d.masteries.reduce((a, b) => a + b, 0) / d.masteries.length * 10) / 10,
      nano_skill_count: d.masteries.length,
      total_events: d.events,
      last_activity: d.lastActivity,
      trend: (d.trends.filter(t => t === 'improving').length > d.trends.filter(t => t === 'declining').length ? 'improving' : d.trends.filter(t => t === 'declining').length > d.trends.filter(t => t === 'improving').length ? 'declining' : 'stable') as 'improving' | 'declining' | 'stable',
    })).sort((a, b) => b.avg_mastery - a.avg_mastery);
  }, [skillsQuery.data]);

  return {
    skills: skillsQuery.data || [],
    categories: categoriesQuery.data || [],
    microSkills,
    isLoading: skillsQuery.isLoading || categoriesQuery.isLoading,
    error: skillsQuery.error || categoriesQuery.error,
    refetch: () => {
      skillsQuery.refetch();
      categoriesQuery.refetch();
    },
  };
}
