
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { useStudents } from '@/hooks/useStudents';
import { useDemoContext } from '@/contexts/DemoContext';
import { useAuthUser } from '@/hooks/useAuthUser';
import { devLog } from '@/utils/logger';

interface OnboardingStep {
  // Section 1 — One-time student setup
  add_student: boolean;
  send_welcome_test: boolean;
  add_goals: boolean;
  generate_roadmap: boolean;
  // Section 2 — Weekly 1-Minute Prep
  generate_next_ideas: boolean;
  pick_idea: boolean;
  generate_worksheet: boolean;
  // Deprecated — kept for backward compatibility with stored profile state
  share_worksheet?: boolean;
  create_homework?: boolean;
}

interface OnboardingProgress {
  steps: OnboardingStep;
  completed: boolean;
  dismissed: boolean;
}

const defaultProgress: OnboardingProgress = {
  steps: {
    add_student: false,
    send_welcome_test: false,
    add_goals: false,
    generate_roadmap: false,
    generate_next_ideas: false,
    pick_idea: false,
    generate_worksheet: false,
  },
  completed: false,
  dismissed: false
};

// Keys that count toward UI completion percentage and rendered steps.
const ACTIVE_KEYS: Array<keyof OnboardingStep> = [
  'add_student',
  'send_welcome_test',
  'add_goals',
  'generate_roadmap',
  'generate_next_ideas',
  'pick_idea',
  'generate_worksheet',
];

function mergeSteps(saved?: Partial<OnboardingStep>): OnboardingStep {
  return { ...defaultProgress.steps, ...(saved || {}) };
}

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
        setProgress({
          ...defaultProgress,
          ...savedProgress,
          steps: mergeSteps(savedProgress?.steps),
        });
      } catch (error) {
        console.error('Error parsing onboarding progress:', error);
        // Fallback to localStorage
        const localProgress = localStorage.getItem('onboarding_progress');
        if (localProgress) {
          try {
            const parsed = JSON.parse(localProgress);
            setProgress({ ...defaultProgress, ...parsed, steps: mergeSteps(parsed?.steps) });
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
          const parsed = JSON.parse(localProgress);
          setProgress({ ...defaultProgress, ...parsed, steps: mergeSteps(parsed?.steps) });
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
      // Run all detection queries in parallel — each is treated as `false` on error
      // so a single broken query never blocks the whole checklist.
      const teacherId = profile.id;
      const [
        studentsRes,
        worksheetsRes,
        testsRes,
        goalsRes,
        phasesRes,
        ideasRes,
        ideasUsedRes,
      ] = await Promise.all([
        supabase.from('students').select('id', { head: true, count: 'exact' }).eq('teacher_id', teacherId),
        supabase
          .from('worksheets')
          .select('id', { head: true, count: 'exact' })
          .eq('teacher_id', teacherId)
          .is('deleted_at', null),
        supabase
          .from('student_tests')
          .select('id', { head: true, count: 'exact' })
          .eq('teacher_id', teacherId)
          .eq('test_type', 'welcome'),
        supabase
          .from('student_progress_goals')
          .select('id', { head: true, count: 'exact' })
          .eq('teacher_id', teacherId)
          .is('deleted_at', null),
        supabase
          .from('dslm_curriculum_phases')
          .select('id', { head: true, count: 'exact' })
          .eq('teacher_id', teacherId),
        supabase
          .from('student_knowledge_entries')
          .select('id', { head: true, count: 'exact' })
          .eq('teacher_id', teacherId)
          .eq('category', 'Next Lesson Ideas')
          .is('deleted_at', null),
        supabase
          .from('student_knowledge_entries')
          .select('id', { head: true, count: 'exact' })
          .eq('teacher_id', teacherId)
          .eq('category', 'Next Lesson Ideas')
          .is('deleted_at', null)
          .not('used_in_worksheet_id', 'is', null),
      ]);

      const safeCount = (res: any): number => (res?.error ? 0 : res?.count ?? 0);

      const newSteps: OnboardingStep = {
        add_student: safeCount(studentsRes) > 0,
        send_welcome_test: safeCount(testsRes) > 0,
        add_goals: safeCount(goalsRes) > 0,
        generate_roadmap: safeCount(phasesRes) > 0,
        generate_next_ideas: safeCount(ideasRes) > 0,
        pick_idea: safeCount(ideasUsedRes) > 0,
        generate_worksheet: safeCount(worksheetsRes) > 0,
      };

      const allCompleted = ACTIVE_KEYS.every((k) => !!newSteps[k]);
      
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
            steps: { ...currentProgress.steps, ...newSteps },
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
          devLog('[Onboarding] Worksheet created, refreshing steps:', payload);
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
          devLog('[Onboarding] Worksheet updated, checking for share_token:', payload);
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
          devLog('[Onboarding] Student added, refreshing steps:', payload);
          setTimeout(checkSteps, 500);
        }
      )
      .subscribe();

    // v6.9.31 — track student_tests, goals, roadmap phases and next-lesson-ideas
    const extraChannel = supabase
      .channel('onboarding-extras')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_tests', filter: `teacher_id=eq.${profile.id}` },
        () => setTimeout(checkSteps, 500))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_progress_goals', filter: `teacher_id=eq.${profile.id}` },
        () => setTimeout(checkSteps, 500))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dslm_curriculum_phases', filter: `teacher_id=eq.${profile.id}` },
        () => setTimeout(checkSteps, 500))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_knowledge_entries', filter: `teacher_id=eq.${profile.id}` },
        () => setTimeout(checkSteps, 500))
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
      supabase.removeChannel(extraChannel);
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
    const completedSteps = ACTIVE_KEYS.filter((k) => !!progress.steps[k]).length;
    return Math.round((completedSteps / ACTIVE_KEYS.length) * 100);
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
    devLog('[Onboarding] Manual refresh triggered');
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
    
    devLog('[Onboarding] Reset completed - onboarding will show again');
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
