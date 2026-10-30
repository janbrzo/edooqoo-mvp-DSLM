import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import type { HubHomework } from '@/lib/studentHub/homeworkLifecycle';

const STORAGE_KEY = 'student_hub_email';
const TTL_DAYS = 30;

export function getSavedHubEmail(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { email, expiresAt } = JSON.parse(raw);
    if (new Date(expiresAt) < new Date()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return email;
  } catch {
    return null;
  }
}

export function saveHubEmail(email: string) {
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, expiresAt }));
}

export function clearHubEmail() {
  localStorage.removeItem(STORAGE_KEY);
}

// Session proof that this browser already supplied the correct Hub
// password for the current (teacherToken, email). Issued by
// get-student-hub-data's `verify_password` action and required back on
// every other Hub call for a student who has a password set (see
// supabase/functions/_shared/hubSession.ts). sessionStorage (not
// localStorage): this is a credential proof, not a convenience value, so it
// should not silently persist across browser restarts on a shared machine.
const SESSION_KEY = 'student_hub_session';

export function getSavedHubSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function saveHubSession(token: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {
    /* sessionStorage may be unavailable in privacy-restricted browsers */
  }
}

export function clearHubSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

import type { HubGoal } from '@/lib/studentHub/hubGoals';

export interface StudentHubData {
  /** Pillar 3.1: live, teacher-confirmed learning goals (absent on older responses). */
  goals?: HubGoal[];
  teacherName: string;
  teacherEmail: string | null;
  studentName: string;
  studentId: string;
  studentEmail: string;
  englishLevel: string | null;
  nativeLanguage: string | null;
  flashcardSets: Array<{
    id: string;
    title: string;
    description: string | null;
    share_token: string;
    cards_count: number;
    mastered_count: number;
    is_bidirectional: boolean;
    back_type: string;
    created_at: string;
    updated_at: string;
    /** v6.9.72: propagated from students.native_language for the Add Card dialog. */
    student_native_language?: string | null;
  }>;
  homeworks: HubHomework[];
  sharedWorksheets: Array<{
    id: string;
    title: string;
    share_token: string | null;
    created_at: string;
    english_level: string | null;
    exercises_count: number;
    linked_slot_date: string | null;
  }>;
  upcomingLessons: Array<{
    id: string;
    slot_date: string;
    start_time: string;
    end_time: string;
    status: string;
    title: string | null;
    notes: string | null;
    meeting_link: string | null;
    confirmed_at: string | null;
    worksheet_share_token: string | null;
  }>;
  stats: {
    totalLessons: number;
    completedLessons: number;
    upcomingLessons: number;
    activeHomeworks: number;
    flashcardSetsCount: number;
    totalFlashcards: number;
    masteredFlashcards: number;
  };
}

export function useStudentHubData(token: string | undefined, email: string | undefined) {
  const [snapshot, setSnapshot] = useState<{ key: string; data: StudentHubData } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const key = JSON.stringify([token ?? '', email?.trim() ?? '']);
  const activeKey = useRef(key);
  activeKey.current = key;

  const fetchData = useCallback(async () => {
    const id = ++requestId.current;
    const isCurrent = () => requestId.current === id && activeKey.current === key;
    if (!token || !email || localStorage.getItem('edooqoo_demo_mode') === 'true') {
      setSnapshot(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSnapshot(null);
    try {
      const { data: result, error: err } = await supabase.functions.invoke('get-student-hub-data', {
        body: { token, email: email.trim(), hubSessionToken: getSavedHubSession() || undefined },
      });
      if (!isCurrent()) return;
      if (err) throw err;
      if (result?.requiresPassword) {
        // The stored session (if any) is no longer valid for this student, 
        // drop it so a future `/my` visit prompts for the password again
        // instead of silently reusing a stale token.
        clearHubSession();
        throw new Error('This Hub is password-protected. Please sign in again.');
      }
      if (result?.error) throw new Error(result.error);
      setSnapshot({ key, data: result });
    } catch (err: any) {
      if (!isCurrent()) return;
      logger.error('Error fetching hub data');
      setError(err.message || 'Failed to load data');
      setSnapshot(null);
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [token, email, key]);

  useEffect(() => {
    fetchData();
    return () => { requestId.current++; };
  }, [fetchData]);

  const data = snapshot?.key === key ? snapshot.data : null;
  return { data, loading, error, refetch: fetchData };
}
