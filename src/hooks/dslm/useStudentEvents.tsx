/**
 * Hook do zarządzania eventami ucznia (DSLM Warstwa A)
 * Pozwala pobierać, dodawać i analizować eventy edukacyjne
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { 
  StudentEvent, 
  CreateStudentEventInput, 
  StudentEventFilters,
  StudentEventStats,
  StudentEventType,
  EventSource
} from '@/types/dslm/events';

interface UseStudentEventsProps {
  studentId: string;
  teacherId: string;
}

interface UseStudentEventsReturn {
  events: StudentEvent[];
  loading: boolean;
  error: string | null;
  stats: StudentEventStats | null;
  fetchEvents: (filters?: StudentEventFilters) => Promise<void>;
  addEvent: (input: Omit<CreateStudentEventInput, 'student_id' | 'teacher_id'>) => Promise<string | null>;
  addTeacherObservation: (claim: string, observationType: 'strength' | 'weakness' | 'behavior' | 'progress' | 'note', weight?: number) => Promise<string | null>;
  getEventStats: () => Promise<StudentEventStats | null>;
  refetch: () => Promise<void>;
}

export const useStudentEvents = ({ 
  studentId, 
  teacherId 
}: UseStudentEventsProps): UseStudentEventsReturn => {
  const [events, setEvents] = useState<StudentEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StudentEventStats | null>(null);

  /**
   * Pobiera eventy z możliwością filtrowania
   */
  const fetchEvents = useCallback(async (filters?: StudentEventFilters) => {
    if (!studentId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      let query = supabase
        .from('student_events')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      
      // Apply filters
      if (filters?.event_types?.length) {
        query = query.in('event_type', filters.event_types);
      }
      if (filters?.event_sources?.length) {
        query = query.in('event_source', filters.event_sources);
      }
      if (filters?.element_types?.length) {
        query = query.in('element_type', filters.element_types);
      }
      if (filters?.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte('created_at', filters.date_to);
      }
      if (filters?.is_processed !== undefined) {
        query = query.eq('is_processed', filters.is_processed);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100); // Default limit
      }
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) {
        throw fetchError;
      }
      
      setEvents((data || []) as StudentEvent[]);
    } catch (err) {
      console.error('Error fetching student events:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  /**
   * Dodaje nowy event
   */
  const addEvent = useCallback(async (
    input: Omit<CreateStudentEventInput, 'student_id' | 'teacher_id'>
  ): Promise<string | null> => {
    // CRITICAL FIX: Validate for actual UUIDs, not just truthy values
    // Empty strings are falsy but pass through || fallbacks
    if (!studentId || studentId.trim() === '' || !teacherId || teacherId.trim() === '') {
      console.warn('⚠️ [useStudentEvents] addEvent skipped - invalid IDs:', { 
        studentId: studentId || '(empty)', 
        teacherId: teacherId || '(empty)',
        eventType: input.event_type 
      });
      return null;
    }
    
    try {
      // Use RPC function for inserting events
      const { data, error: insertError } = await supabase.rpc('add_student_event', {
        p_student_id: studentId,
        p_teacher_id: teacherId,
        p_event_type: input.event_type,
        p_event_source: input.event_source,
        p_source_id: input.source_id ?? null,
        p_event_payload: (input.event_payload ?? {}) as unknown as Record<string, never>,
        p_skill_ids: input.skill_ids ?? null,
        p_element_type: input.element_type ?? null,
        p_session_id: input.session_id ?? null
      });
      
      if (insertError) {
        throw insertError;
      }
      
      return data || null;
    } catch (err) {
      console.error('Error adding student event:', err);
      setError(err instanceof Error ? err.message : 'Failed to add event');
      return null;
    }
  }, [studentId, teacherId]);

  /**
   * Skrót do dodawania obserwacji nauczyciela
   */
  const addTeacherObservation = useCallback(async (
    claim: string,
    observationType: 'strength' | 'weakness' | 'behavior' | 'progress' | 'note',
    weight: number = 0.8
  ): Promise<string | null> => {
    return addEvent({
      event_type: 'teacher_observation',
      event_source: 'teacher',
      event_payload: {
        observation_type: observationType,
        claim,
        weight
      }
    });
  }, [addEvent]);

  /**
   * Oblicza statystyki eventów
   */
  const getEventStats = useCallback(async (): Promise<StudentEventStats | null> => {
    if (!studentId) return null;
    
    try {
      // Pobierz wszystkie eventy dla statystyk
      const { data, error: fetchError } = await supabase
        .from('student_events')
        .select('event_type, event_source, created_at')
        .eq('student_id', studentId);
      
      if (fetchError) {
        throw fetchError;
      }
      
      if (!data || data.length === 0) {
        const emptyStats: StudentEventStats = {
          total_events: 0,
          events_by_type: {} as Record<StudentEventType, number>,
          events_by_source: {} as Record<EventSource, number>,
          events_last_7_days: 0,
          events_last_30_days: 0,
          last_event_at: null
        };
        setStats(emptyStats);
        return emptyStats;
      }
      
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const eventsByType: Record<string, number> = {};
      const eventsBySource: Record<string, number> = {};
      let eventsLast7Days = 0;
      let eventsLast30Days = 0;
      let lastEventAt: string | null = null;
      
      data.forEach((event) => {
        // Count by type
        eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;
        
        // Count by source
        eventsBySource[event.event_source] = (eventsBySource[event.event_source] || 0) + 1;
        
        // Count by time window
        const eventDate = new Date(event.created_at);
        if (eventDate >= sevenDaysAgo) {
          eventsLast7Days++;
        }
        if (eventDate >= thirtyDaysAgo) {
          eventsLast30Days++;
        }
        
        // Track last event
        if (!lastEventAt || event.created_at > lastEventAt) {
          lastEventAt = event.created_at;
        }
      });
      
      const computedStats: StudentEventStats = {
        total_events: data.length,
        events_by_type: eventsByType as Record<StudentEventType, number>,
        events_by_source: eventsBySource as Record<EventSource, number>,
        events_last_7_days: eventsLast7Days,
        events_last_30_days: eventsLast30Days,
        last_event_at: lastEventAt
      };
      
      setStats(computedStats);
      return computedStats;
    } catch (err) {
      console.error('Error computing event stats:', err);
      return null;
    }
  }, [studentId]);

  /**
   * Odświeża eventy
   */
  const refetch = useCallback(async () => {
    await fetchEvents();
    await getEventStats();
  }, [fetchEvents, getEventStats]);

  return {
    events,
    loading,
    error,
    stats,
    fetchEvents,
    addEvent,
    addTeacherObservation,
    getEventStats,
    refetch
  };
};
