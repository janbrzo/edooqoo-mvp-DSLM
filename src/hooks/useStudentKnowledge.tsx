import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  StudentKnowledgeEntry,
  NewKnowledgeEntry,
  UpdateKnowledgeEntry,
  KnowledgeFilters,
  DEFAULT_FILTERS,
} from '@/types/studentKnowledge';

const isValidUUID = (uuid: string): boolean => {
  if (!uuid || uuid.trim() === '') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

interface UseStudentKnowledgeProps {
  studentId: string;
  teacherId: string;
}

interface KnowledgeQueryResult {
  entries: StudentKnowledgeEntry[];
  totalCount: number;
}

export const useStudentKnowledge = ({ studentId, teacherId }: UseStudentKnowledgeProps) => {
  const queryClient = useQueryClient();
  const [filters, setFiltersState] = useState<KnowledgeFilters>(DEFAULT_FILTERS);

  const idsValid = isValidUUID(studentId) && isValidUUID(teacherId);

  // Stable serialization of filters for queryKey
  const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

  const entriesQuery = useQuery<KnowledgeQueryResult>({
    queryKey: ['knowledge', 'entries', studentId, teacherId, filtersKey],
    enabled: idsValid,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from('student_knowledge_entries')
        .select('*', { count: 'exact' })
        .eq('student_id', studentId)
        .eq('teacher_id', teacherId)
        .is('deleted_at', null);

      if (!filters.showOutdated) query = query.eq('is_outdated', false);
      if (filters.category) query = query.eq('category', filters.category);
      if (filters.tags && filters.tags.length > 0) query = query.overlaps('tags', filters.tags);
      if (filters.search) query = query.ilike('content', `%${filters.search}%`);
      if (filters.worksheetId) query = query.eq('worksheet_id', filters.worksheetId);
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

      if (filters.sortBy === 'newest') query = query.order('created_at', { ascending: false });
      else if (filters.sortBy === 'oldest') query = query.order('created_at', { ascending: true });
      else if (filters.sortBy === 'category') query = query.order('category', { ascending: true }).order('created_at', { ascending: false });

      const limit = filters.limit || DEFAULT_FILTERS.limit!;
      const offset = filters.offset || DEFAULT_FILTERS.offset!;
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { entries: (data || []) as StudentKnowledgeEntry[], totalCount: count || 0 };
    },
  });

  const tagsQuery = useQuery<string[]>({
    queryKey: ['knowledge', 'tags', studentId, teacherId],
    enabled: idsValid,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_student_tags', {
        p_student_id: studentId,
        p_teacher_id: teacherId,
      });
      if (error) throw error;
      return data || [];
    },
  });

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['knowledge', 'entries', studentId, teacherId] });
    queryClient.invalidateQueries({ queryKey: ['knowledge', 'tags', studentId, teacherId] });
  }, [queryClient, studentId, teacherId]);

  const addMutation = useMutation({
    mutationFn: async (entry: Omit<NewKnowledgeEntry, 'student_id' | 'teacher_id'>) => {
      const insertData = {
        student_id: studentId,
        teacher_id: teacherId,
        category: entry.category,
        content: entry.content,
        tags: entry.tags || [],
        worksheet_id: entry.worksheet_id || null,
        entry_source: entry.entry_source || 'manual',
        metadata: (entry.metadata || {}) as Record<string, unknown>,
      };
      const { data, error } = await supabase
        .from('student_knowledge_entries')
        .insert(insertData as any)
        .select()
        .single();
      if (error) throw error;
      // v6.9.8 — fire-and-forget AI classification (only when teacher didn't pick a specific category)
      if (entry.category === 'Notes' && data?.id) {
        (async () => {
          try {
            // Lightweight student context (best-effort)
            const { data: stu } = await supabase
              .from('students')
              .select('english_level, main_goal')
              .eq('id', studentId)
              .maybeSingle();
            const { data: clsRes } = await supabase.functions.invoke('classify-knowledge-entry', {
              body: {
                content: entry.content,
                englishLevel: stu?.english_level || '',
                mainGoal: stu?.main_goal || '',
              },
            });
            const c = (clsRes as any)?.classification;
            if (!c) return;
            const conf = typeof c.confidence === 'number' ? c.confidence : 0;
            const acceptCategory = conf >= 0.6 && c.category && c.category !== 'Notes';
            const newMetadata: Record<string, unknown> = { ...(insertData.metadata as any) };
            if (c.skill_subtype) newMetadata.skill_subtype = c.skill_subtype;
            if (c.element_type) newMetadata.element_type = c.element_type;
            if (c.nano_skill) newMetadata.nano_skill = c.nano_skill;
            if (typeof c.suggested_mastery === 'number') newMetadata.mastery = c.suggested_mastery;
            if (c.sub_category) newMetadata.sub_category = c.sub_category;
            const mergedTags = Array.from(new Set([...(insertData.tags as string[]), ...((c.tags as string[]) || [])])).slice(0, 8);
            await supabase
              .from('student_knowledge_entries')
              .update({
                category: acceptCategory ? c.category : 'Notes',
                tags: mergedTags,
                metadata: newMetadata as any,
                ai_classified: true,
                ai_confidence: conf,
              } as any)
              .eq('id', data.id);
            queryClient.invalidateQueries({ queryKey: ['knowledge', 'entries', studentId, teacherId] });
          } catch (e) {
            // Silent: classification is best-effort
            console.warn('[v6.9.8] knowledge classify failed', e);
          }
        })();
      }
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Success', description: 'Knowledge entry added successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed to add', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ entryId, updates }: { entryId: string; updates: UpdateKnowledgeEntry }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (updates.metadata) updateData.metadata = updates.metadata as Record<string, unknown>;
      const { data, error } = await supabase
        .from('student_knowledge_entries')
        .update(updateData)
        .eq('id', entryId)
        .eq('teacher_id', teacherId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Success', description: 'Knowledge entry updated successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed to update', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { data, error } = await supabase.rpc('soft_delete_knowledge_entry', {
        p_entry_id: entryId,
        p_teacher_id: teacherId,
      });
      if (error) throw error;
      if (!data) throw new Error('Entry not found or no permission');
      return true;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Success', description: 'Knowledge entry deleted successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed to delete', variant: 'destructive' });
    },
  });

  const markOutdatedMutation = useMutation({
    mutationFn: async ({ entryId, reason }: { entryId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('mark_knowledge_outdated', {
        p_entry_id: entryId,
        p_teacher_id: teacherId,
        p_reason: reason || null,
      });
      if (error) throw error;
      if (!data) throw new Error('Entry not found or no permission');
      return true;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Success', description: 'Knowledge entry marked as outdated' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed', variant: 'destructive' });
    },
  });

  const markCurrentMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const { data, error } = await supabase.rpc('mark_knowledge_current', {
        p_entry_id: entryId,
        p_teacher_id: teacherId,
      });
      if (error) throw error;
      if (!data) throw new Error('Entry not found or no permission');
      return true;
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: 'Success', description: 'Knowledge entry marked as current' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err?.message || 'Failed', variant: 'destructive' });
    },
  });

  const entries = entriesQuery.data?.entries || [];
  const totalCount = entriesQuery.data?.totalCount || 0;
  const limit = filters.limit || DEFAULT_FILTERS.limit!;
  const offset = filters.offset || DEFAULT_FILTERS.offset!;
  const hasMore = totalCount > offset + limit;

  // Public API kept compatible with previous hook
  const fetchEntries = useCallback((newFilters?: Partial<KnowledgeFilters>) => {
    if (newFilters) setFiltersState(prev => ({ ...prev, ...newFilters }));
    else entriesQuery.refetch();
  }, [entriesQuery]);

  const fetchSuggestedTags = useCallback(() => {
    tagsQuery.refetch();
  }, [tagsQuery]);

  const setFilters = useCallback((next: KnowledgeFilters | ((prev: KnowledgeFilters) => KnowledgeFilters)) => {
    setFiltersState(next as any);
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || entriesQuery.isFetching) return;
    setFiltersState(prev => ({ ...prev, offset: (prev.offset || 0) + (prev.limit || DEFAULT_FILTERS.limit!) }));
  }, [hasMore, entriesQuery.isFetching]);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const isMutating = addMutation.isPending || updateMutation.isPending || deleteMutation.isPending || markOutdatedMutation.isPending || markCurrentMutation.isPending;

  return {
    entries,
    isLoading: entriesQuery.isLoading || isMutating,
    error: entriesQuery.error ? (entriesQuery.error as Error).message : null,
    filters,
    totalCount,
    hasMore,
    suggestedTags: tagsQuery.data || [],
    fetchEntries,
    fetchSuggestedTags,
    addEntry: (entry: Omit<NewKnowledgeEntry, 'student_id' | 'teacher_id'>) => addMutation.mutateAsync(entry),
    updateEntry: (entryId: string, updates: UpdateKnowledgeEntry) => updateMutation.mutateAsync({ entryId, updates }),
    deleteEntry: (entryId: string) => deleteMutation.mutateAsync(entryId),
    markAsOutdated: (entryId: string, reason?: string) => markOutdatedMutation.mutateAsync({ entryId, reason }),
    markAsCurrent: (entryId: string) => markCurrentMutation.mutateAsync(entryId),
    loadMore,
    resetFilters,
    setFilters,
  };
};
