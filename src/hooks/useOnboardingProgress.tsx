
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useStudents } from '@/hooks/useStudents';
import { useDemoContext } from '@/contexts/DemoContext';
import { useAuthUser } from '@/hooks/useAuthUser';
import { devLog } from '@/utils/logger';

interface OnboardingStep {
  add_student: boolean;
  generate_worksheet: boolean;
  share_worksheet: boolean;
  create_homework: boolean;
}

interface OnboardingProgress {
  steps: OnboardingStep;
  completed: boolean;
  dismissed: boolean;
}

const defaultProgress: OnboardingProgress = {
  steps: {
    add_student: false,
    generate_worksheet: false,
    share_worksheet: false,
    create_homework: false
  },
  completed: false,
  dismissed: false
};

export const useOnboardingProgress = () => {
  const [progress, setProgress] = useState<OnboardingProgress>(defaultProgress);
  const [loading, setLoading] = useState(true);
  const { profile } = useProfile();
  const { students } = useStudents();
  const intervalRef = useRef<NodeJS.Timeout>();
  const { isDemoMode } = useDemoContext();
  const { data: authUser } = useAuthUser();
  const isAnonymousUser = !!authUser?.is_anonymous;

  // Throttling refs — prevent request storms
  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);
  const errorBackoffUntilRef = useRef(0);

  // Load progress from profile or localStorage
  useEffect(() => {
    const profileWithOnboarding = profile as any;
    if (profileWithOnboarding?.onboarding_progress) {
      try {
        const savedProgress = profileWithOnboarding.onboarding_progress as OnboardingProgress;
        setProgress(savedProgress);
      } catch (error) {
        console.error('Error parsing onboarding progress:', error);
        // Fallback to localStorage
        const localProgress = localStorage.getItem('onboarding_progress');
        if (localProgress) {
          try {
            setProgress(JSON.parse(localProgress));
          } catch (e) {
            setProgress(defaultProgress);
          }
        }
      }
    } else {
      // Fallback to localStorage
      const localProgress = localStorage.getItem('onboarding_progress');
      if (localProgress) {
        try {
          setProgress(JSON.parse(localProgress));
        } catch (error) {
          setProgress(defaultProgress);
        }
      }
    }
    setLoading(false);
  }, [profile]);

  // ULTRA-ENHANCED: Check step completion with IMMEDIATE database sync and forced refresh
  const checkSteps = useCallback(async () => {
    if (isDemoMode || loading || !profile?.id || isAnonymousUser) {
      return;
    }
    if (inFlightRef.current) return;
    const now = Date.now();
    if (now - lastRunRef.current < 3000) return; // 3s debounce
    if (now < errorBackoffUntilRef.current) return; // 30s error backoff
    inFlightRef.current = true;
    lastRunRef.current = now;
    devLog('[Onboarding] Checking steps from database', { studentsCount: students.length });

    try {
      // CRITICAL: Always check students directly from database for real-time accuracy
      const { data: dbStudents, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('teacher_id', profile.id);
        
      if (studentsError) {
        devLog('[Onboarding] Error checking students from DB:', studentsError);
        errorBackoffUntilRef.current = Date.now() + 30000;
        return;
      }
      
      const studentsCount = dbStudents?.length || 0;

      // CRITICAL: Always check worksheets directly from database for real-time accuracy
      const { data: dbWorksheets, error: worksheetsError } = await supabase
        .from('worksheets')
        .select('id, share_token')
        .eq('teacher_id', profile.id)
        .is('deleted_at', null);
        
      if (worksheetsError) {
        devLog('[Onboarding] Error checking worksheets from DB:', worksheetsError);
        errorBackoffUntilRef.current = Date.now() + 30000;
        return;
      }
      
      const worksheetsCount = dbWorksheets?.length || 0;
      const sharedWorksheetsCount = dbWorksheets?.filter(w => w.share_token)?.length || 0;
      
      // Check homework
      const { data: dbHomework, error: homeworkError } = await supabase
        .from('homework_assignments')
        .select('id')
        .eq('teacher_id', profile.id)
        .limit(1);
        
      if (homeworkError) {
        devLog('[Onboarding] Error checking homework from DB:', homeworkError);
        errorBackoffUntilRef.current = Date.now() + 30000;
        return;
      }
      
      const homeworkCount = dbHomework?.length || 0;

      const newSteps: OnboardingStep = {
        add_student: studentsCount > 0,
        generate_worksheet: worksheetsCount > 0,
        share_worksheet: sharedWorksheetsCount > 0,
        create_homework: homeworkCount > 0
      };

      const allCompleted = Object.values(newSteps).every(step => step);
      
      // CRITICAL: Force refresh onboarding progress from database immediately after checking steps
      const { data: currentOnboardingData } = await supabase
        .from('profiles')
        .select('onboarding_progress')
        .eq('id', profile.id)
        .single();
      
      // Use setProgress with function to avoid stale closures
      setProgress(currentProgress => {
        const hasChanges = JSON.stringify(newSteps) !== JSON.stringify(currentProgress.steps);

        // ADDED: Force update if dismissed status changed - FIXED TypeScript casting
        let dbProgress: OnboardingProgress | null = null;
        try {
          if (currentOnboardingData?.onboarding_progress && typeof currentOnboardingData.onboarding_progress === 'object') {
            dbProgress = currentOnboardingData.onboarding_progress as unknown as OnboardingProgress;
          }
        } catch (e) {
          devLog('[Onboarding] Failed to parse onboarding_progress from DB:', e);
        }
        
        const dismissedChanged = dbProgress && (dbProgress.dismissed !== currentProgress.dismissed);

        if (currentProgress.dismissed && !dismissedChanged) {
          return currentProgress; // No changes needed if truly dismissed
        }

        if (hasChanges || (allCompleted && !currentProgress.completed) || dismissedChanged) {
          const newProgress: OnboardingProgress = {
            ...currentProgress,
            steps: newSteps,
            completed: allCompleted,
            dismissed: dbProgress?.dismissed || currentProgress.dismissed // Sync dismissed state from DB
          };

          // ADDED: Always save progress after checking steps for immediate sync
          setTimeout(() => saveProgress(newProgress), 100);
          return newProgress;
        }

        return currentProgress;
      });
    } catch (error) {
      devLog('[Onboarding] Error in checkSteps:', error);
      errorBackoffUntilRef.current = Date.now() + 30000;
    } finally {
      inFlightRef.current = false;
    }
  }, [profile?.id, loading, isDemoMode, isAnonymousUser]);

  // Initial check and dependencies effect
  useEffect(() => {
    checkSteps();
  }, [profile?.id, loading]);

  // Real-time subscriptions and periodic checking - FIXED: simpler dependency management
  useEffect(() => {
    if (isDemoMode || loading || !profile?.id || isAnonymousUser) return;

    devLog('[Onboarding] Setting up real-time subscriptions and periodic check');

    // Set up real-time subscription for worksheets
    const worksheetChannel = supabase
      .channel('onboarding-worksheets')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'worksheets',
          filter: `teacher_id=eq.${profile.id}`
        },
        (payload) => {
          console.log('[Onboarding] Worksheet created, refreshing steps:', payload);
          setTimeout(checkSteps, 1000); // Small delay to ensure profile is updated
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'worksheets',
          filter: `teacher_id=eq.${profile.id}`
        },
        (payload) => {
          console.log('[Onboarding] Worksheet updated, checking for share_token:', payload);
          if (payload.new.share_token && !payload.old.share_token) {
            setTimeout(checkSteps, 500); // Check immediately when worksheet is shared
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for students
    const studentChannel = supabase
      .channel('onboarding-students')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'students',
          filter: `teacher_id=eq.${profile.id}`
        },
        (payload) => {
          console.log('[Onboarding] Student added, refreshing steps:', payload);
          setTimeout(checkSteps, 500);
        }
      )
      .subscribe();

    // Periodic safety net — realtime is the primary trigger
    intervalRef.current = setInterval(() => {
      checkSteps();
    }, 60000); // 60s — realtime + window focus already cover most cases
    
    // ADDED: Force refresh on window focus for better responsiveness
    const handleWindowFocus = () => {
      setTimeout(checkSteps, 500);
    };
    
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      supabase.removeChannel(worksheetChannel);
      supabase.removeChannel(studentChannel);
      window.removeEventListener('focus', handleWindowFocus);  // ADDED: cleanup
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [profile?.id, loading, checkSteps, isAnonymousUser, isDemoMode]);

  const saveProgress = async (newProgress: OnboardingProgress) => {
    // Save to localStorage as fallback
    localStorage.setItem('onboarding_progress', JSON.stringify(newProgress));

    // Save to Supabase if user is authenticated
    if (profile?.id) {
      try {
        await supabase
          .from('profiles')
          .update({ 
            onboarding_progress: newProgress as any
          } as any)
          .eq('id', profile.id);
      } catch (error) {
        console.error('Error saving onboarding progress:', error);
      }
    }
  };

  const dismissOnboarding = async () => {
    const newProgress: OnboardingProgress = {
      ...progress,
      dismissed: true
    };
    
    setProgress(newProgress);
    await saveProgress(newProgress);
  };

  const getCompletionPercentage = () => {
    const completedSteps = Object.values(progress.steps).filter(Boolean).length;
    const totalSteps = Object.keys(progress.steps).length;
    return Math.round((completedSteps / totalSteps) * 100);
  };

  const shouldShow = () => {
    if (isDemoMode) return false;
    if (isAnonymousUser) return false;
    // Nie pokazuj onboarding dla anonimowych użytkowników (bez email)
    const isAnonymous = !profile?.email || profile.email === '';
    return !progress.dismissed && !progress.completed && profile?.id && !isAnonymous;
  };

  // Manual refresh function to trigger from components
  const refreshProgress = useCallback(() => {
    console.log('[Onboarding] Manual refresh triggered');
    checkSteps();
  }, [checkSteps]);

  // NEW: Reset onboarding to show it again
  const resetOnboarding = async () => {
    const newProgress: OnboardingProgress = {
      ...defaultProgress,
      dismissed: false,
      completed: false
    };
    
    setProgress(newProgress);
    await saveProgress(newProgress);
    
    // Clear session storage
    sessionStorage.removeItem('onboarding-temp-dismissed');
    
    console.log('[Onboarding] Reset completed - onboarding will show again');
  };

  return {
    progress,
    loading,
    dismissOnboarding,
    getCompletionPercentage,
    shouldShow,
    saveProgress,
    refreshProgress,
    resetOnboarding
  };
};
