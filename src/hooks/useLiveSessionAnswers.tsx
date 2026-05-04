// ============================================
// FAZA 2: Interactive Shared Worksheets - Teacher Live Session Hook
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExerciseAnswers } from '@/types/interactiveHomework';
import { LiveSessionAnswer } from '@/types/interactiveSharedWorksheet';
import { useDemoContext } from '@/contexts/DemoContext';
import { devLog, devWarn } from '@/utils/logger';

interface UseLiveSessionAnswersProps {
  worksheetId: string;
  enabled: boolean; // Only subscribe when in Live Session mode
}

export const useLiveSessionAnswers = ({
  worksheetId,
  enabled
}: UseLiveSessionAnswersProps) => {
  const { isDemoMode } = useDemoContext();
  const [liveAnswers, setLiveAnswers] = useState<Record<number, ExerciseAnswers>>({});
  const [liveItemEvaluations, setLiveItemEvaluations] = useState<Record<number, any[]>>({});
  const [liveAudioAnswers, setLiveAudioAnswers] = useState<Record<number, Record<number, string>>>({});
  const [liveAiEvaluations, setLiveAiEvaluations] = useState<Record<number, any>>({});
  const [studentEmail, setStudentEmail] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Guard against multiple processPendingAiEvals calls
  const hasProcessedRef = useRef(false);

  // Load initial answers from database
  const loadInitialAnswers = useCallback(async () => {
    if (!worksheetId || isDemoMode) return;
    
    try {
      devLog('[useLiveSessionAnswers] Loading initial answers for worksheet:', worksheetId);
      
      const { data, error } = await supabase.rpc('get_worksheet_live_answers', {
        p_worksheet_id: worksheetId
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedAnswers: Record<number, ExerciseAnswers> = {};
        const loadedEvals: Record<number, any[]> = {};
        const loadedAudio: Record<number, Record<number, string>> = {};
        const loadedAiEvals: Record<number, any> = {};
        let latestEmail: string | null = null;

        data.forEach((answer: any) => {
          loadedAnswers[answer.exercise_index] = answer.answers as ExerciseAnswers;
          if (!latestEmail) latestEmail = answer.student_email;
          if (answer.item_evaluations && Array.isArray(answer.item_evaluations)) {
            loadedEvals[answer.exercise_index] = answer.item_evaluations;
          }
          if (answer.audio_answers && typeof answer.audio_answers === 'object') {
            loadedAudio[answer.exercise_index] = answer.audio_answers as Record<number, string>;
          }
          if (answer.ai_evaluation && typeof answer.ai_evaluation === 'object') {
            loadedAiEvals[answer.exercise_index] = answer.ai_evaluation;
          }
        });

        setLiveAnswers(loadedAnswers);
        setLiveItemEvaluations(loadedEvals);
        setLiveAudioAnswers(loadedAudio);
        setLiveAiEvaluations(loadedAiEvals);
        setStudentEmail(latestEmail);
        setLastUpdatedAt(new Date());
        devLog('[useLiveSessionAnswers] Loaded initial answers:', loadedAnswers, 'evals:', loadedEvals);
      }
    } catch (error) {
      console.error('[useLiveSessionAnswers] Error loading initial answers:', error);
    }
  }, [worksheetId, isDemoMode]);

  // Process any pending AI evaluations - called ONCE on mount
  const processPendingAiEvals = useCallback(async () => {
    if (!worksheetId || isDemoMode) return;
    
    try {
      devLog('[useLiveSessionAnswers] Processing pending AI evaluations for worksheet:', worksheetId);
      
      const { data, error } = await supabase.functions.invoke('process-pending-ai-evaluations', {
        body: { worksheet_id: worksheetId }
      });
      
      if (error) {
        devWarn('[useLiveSessionAnswers] Failed to process pending AI evals:', error);
      } else {
        devLog('[useLiveSessionAnswers] Pending AI evals result:', data);
        // Reload answers if any were processed
        if (data?.processed > 0) {
          loadInitialAnswers();
        }
      }
    } catch (error) {
      devWarn('[useLiveSessionAnswers] Error processing pending AI evals:', error);
    }
  }, [worksheetId, loadInitialAnswers]);

  // Subscribe to Realtime changes
  // FIX: Remove loadInitialAnswers and processPendingAiEvals from deps to prevent re-render loop
  useEffect(() => {
    if (!enabled || !worksheetId || isDemoMode) {
      setIsConnected(false);
      return;
    }

    devLog('[useLiveSessionAnswers] Setting up Realtime subscription for worksheet:', worksheetId);
    
    // Load initial data first
    loadInitialAnswers();
    
    // Process pending AI evaluations ONCE on mount
    if (!hasProcessedRef.current) {
      hasProcessedRef.current = true;
      processPendingAiEvals();
    }

    // Set up Realtime subscription
    const channel = supabase
      .channel(`worksheet-answers-${worksheetId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'worksheet_student_answers',
          filter: `worksheet_id=eq.${worksheetId}`
        },
        (payload) => {
          devLog('[useLiveSessionAnswers] Realtime update received:', payload.eventType);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newData = payload.new as any;
            
            setLiveAnswers(prev => ({
              ...prev,
              [newData.exercise_index]: newData.answers as ExerciseAnswers
            }));
            
            setStudentEmail(newData.student_email);
            setLastUpdatedAt(new Date());
            
            // FIX: Realtime payload may not include item_evaluations
            // If this is an UPDATE with item_evaluations, refetch full data
            if (payload.eventType === 'UPDATE' && newData.item_evaluations) {
              setLiveItemEvaluations(prev => ({
                ...prev,
                [newData.exercise_index]: newData.item_evaluations
              }));
            } else if (payload.eventType === 'UPDATE') {
              // Refetch to get item_evaluations that may not be in Realtime payload
              loadInitialAnswers();
            }
          } else if (payload.eventType === 'DELETE') {
            // @ts-ignore - payload.old may not have type
            const oldData = payload.old as LiveSessionAnswer;
            
            setLiveAnswers(prev => {
              const updated = { ...prev };
              delete updated[oldData.exercise_index];
              return updated;
            });
          }
        }
      )
      .subscribe((status) => {
        devLog('[useLiveSessionAnswers] Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    // Cleanup on unmount or when disabled
    return () => {
      devLog('[useLiveSessionAnswers] Removing Realtime subscription');
      supabase.removeChannel(channel);
      setIsConnected(false);
      hasProcessedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksheetId, enabled]);

  // PROBLEM 1 FIX: Polling every 15s to catch AI evaluations that Realtime may miss
  useEffect(() => {
    if (!enabled || !worksheetId || isDemoMode) return;
    const interval = setInterval(() => {
      devLog('[useLiveSessionAnswers] Polling for AI evaluations...');
      loadInitialAnswers();
    }, 15000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksheetId, enabled]);

  // Clear answers when disabled
  useEffect(() => {
    if (!enabled) {
      setLiveAnswers({});
      setStudentEmail(null);
      setLastUpdatedAt(null);
    }
  }, [enabled]);

  return {
    liveAnswers,
    liveItemEvaluations,
    liveAiEvaluations,
    liveAudioAnswers,
    studentEmail,
    lastUpdatedAt,
    isConnected,
    refetch: loadInitialAnswers
  };
};
