import { useCallback, useEffect, useState } from 'react';
import { fetchStudentReview, type StudentReview } from '@/lib/homework/reviewForStudent';
import { homeworkState } from '@/lib/homework/reviewState';
import type { HubHomework } from '@/lib/studentHub/homeworkLifecycle';

export interface HomeworkFeedbackScope {
  teacherToken: string;
  email: string;
  homework: HubHomework;
}

type FeedbackResult =
  | { key: string; status: 'ready'; review: StudentReview }
  | { key: string; status: 'loading' | 'unavailable' | 'error'; review: null };

/** Lazy authorized read. A changed scope hides the old result before the next effect runs. */
export function useStudentHomeworkFeedback(scope: HomeworkFeedbackScope | null) {
  const [result, setResult] = useState<FeedbackResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const token = scope?.homework.share_token ?? '';
  const email = scope?.email.trim() ?? '';
  const teacherToken = scope?.teacherToken ?? '';
  const homeworkId = scope?.homework.id ?? '';
  const reviewedAt = scope?.homework.reviewed_at ?? '';
  const eligible = !!scope && localStorage.getItem('edooqoo_demo_mode') !== 'true' && homeworkState(scope.homework) === 'reviewed';
  const key = eligible && token && email && teacherToken && homeworkId && reviewedAt
    ? JSON.stringify([teacherToken, email, homeworkId, token, reviewedAt]) : '';

  useEffect(() => {
    if (!key || localStorage.getItem('edooqoo_demo_mode') === 'true') {
      setResult(null);
      return;
    }
    let cancelled = false;
    setResult({ key, status: 'loading', review: null });
    fetchStudentReview(token, email)
      .then(review => {
        if (!cancelled) setResult(review
          ? { key, status: 'ready', review }
          : { key, status: 'unavailable', review: null });
      })
      .catch(() => {
        if (!cancelled) setResult({ key, status: 'error', review: null });
      });
    return () => { cancelled = true; };
  }, [key, token, email, attempt]);

  const retry = useCallback(() => {
    setResult(null);
    setAttempt(value => value + 1);
  }, []);
  const current = key && result?.key === key ? result : null;
  return { status: current?.status ?? (key ? 'loading' : 'unavailable'), review: current?.review ?? null, retry };
}