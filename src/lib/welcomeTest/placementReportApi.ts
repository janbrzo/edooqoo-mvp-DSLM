import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { PublicPlacementResult } from '@/lib/welcomeTest/publicPlacementTest';

export const PENDING_PLACEMENT_CLAIM_KEY = 'edooqoo_pending_placement_claim';
export const PLACEMENT_REPORT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export interface PlacementLessonProposal {
  id: string;
  topic: string;
  goal: string | null;
  additionalInfo: string | null;
  grammarFocus: string | null;
  exercises: string[];
  exerciseFocusMap: Record<string, string>;
  rationale: string | null;
  difficulty: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
}
export type PlacementNextStepsState =
  | { status: 'idle' | 'running' }
  | { status: 'ready'; suggestions: PlacementLessonProposal[] }
  | { status: 'failed'; error: string; retryable: boolean };

export interface PlacementReport {
  /** Decided by the server from the token, never by the URL. */
  role: 'teacher' | 'student';
  studentName: string;
  result: PublicPlacementResult;
  expiresAt: string;
  claimed: boolean;
  nextSteps?: PlacementNextStepsState;
  teacherDiagnostic?: {
    studentId: string;
    testId: string;
    test: {
      id: string;
      status: string;
      score_percentage: number | null;
      answered_count: number | null;
      total_questions: number | null;
      completed_at: string | null;
      reviewed_at: string | null;
      time_spent_seconds: number | null;
    } | null;
    learningProfile: Record<string, unknown> | null;
    skillResults: Array<{
      element_type: string;
      correct_answers: number;
      total_questions: number;
      score_percentage: number | null;
      suggested_rating?: number | null;
      skill_tags?: string[] | null;
    }>;
    questions: Array<{
      id: string;
      question_index: number;
      question_type: string;
      question_text: string;
      question_data: Record<string, unknown> | null;
      correct_answer: unknown;
      explanation: string | null;
      element_type: string | null;
      difficulty_level: string | null;
      skill_tags: string[] | null;
      student_answer: unknown;
      is_correct: boolean | null;
      answered_at: string | null;
      ai_feedback: string | null;
    }>;
    goals: Array<Record<string, unknown>>;
    nextSteps: Array<Record<string, unknown>>;
    curriculumPhases: Array<Record<string, unknown>>;
  };
}

export type TeacherPlacementDiagnostic = NonNullable<PlacementReport['teacherDiagnostic']>;

export class PlacementReportError extends Error {
  constructor(message: string, public status: number | null) { super(message); }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('public-placement-report', { body });
  if (error) {
    let message = error.message;
    let status: number | null = null;
    if (error instanceof FunctionsHttpError) {
      status = error.context.status;
      try { message = (await error.context.json()).error ?? message; } catch { /* keep message */ }
    }
    throw new PlacementReportError(message, status);
  }
  return data as T;
}

export function submitPlacementReport(input: {
  result: PublicPlacementResult;
  answers?: Record<string, unknown>;
  studentName: string;
  studentEmail: string;
  teacherEmail: string;
  inviteToken?: string | null;
}) {
  return call<{ success: true; studentUrl: string; studentSent: boolean; teacherSent: boolean; sentToInvitingTeacher: boolean; autoClaimed: boolean }>({
    action: 'submit',
    ...input,
    answers: input.answers && Object.keys(input.answers).length > 0 ? input.answers : undefined,
    inviteToken: input.inviteToken ?? undefined,
  });
}

export const getPlacementReport = (token: string) => call<PlacementReport>({ action: 'get', token });
export const generatePlacementNextSteps = (token: string) =>
  call<PlacementNextStepsState>({ action: 'generate_next_steps', token });
export const forwardPlacementReport = (token: string, teacherEmail: string) =>
  call<{ success: true }>({ action: 'forward', token, teacherEmail });
export const claimPlacementReport = (token: string) =>
  call<{ success: true; studentId: string; testId: string; alreadyClaimed?: boolean }>({ action: 'claim', token });

export function peekPendingClaim(): string | null {
  try {
    const token = localStorage.getItem(PENDING_PLACEMENT_CLAIM_KEY);
    return token && PLACEMENT_REPORT_TOKEN_PATTERN.test(token) ? token : null;
  } catch { return null; }
}

export function clearPostSignupAddStudentIntent(): void {
  try { localStorage.removeItem('post-signup-add-student'); } catch { /* storage unavailable */ }
}

export function rememberPendingClaim(token: string): void {
  try { localStorage.setItem(PENDING_PLACEMENT_CLAIM_KEY, token); } catch { /* storage unavailable */ }
}
export function takePendingClaim(): string | null {
  try {
    const token = localStorage.getItem(PENDING_PLACEMENT_CLAIM_KEY);
    localStorage.removeItem(PENDING_PLACEMENT_CLAIM_KEY);
    return token && PLACEMENT_REPORT_TOKEN_PATTERN.test(token) ? token : null;
  } catch { return null; }
}

export const PLACEMENT_INVITE_STORAGE_KEY = 'edooqoo_public_placement_invite';

export function sendPlacementInvite(input: { studentName: string; studentEmail: string; teacherEmail: string; teacherName?: string }) {
  return call<{ success: true; testUrl: string; studentSent: boolean; teacherConfirmed: boolean }>({ action: 'invite', ...input });
}

export const getPlacementInvite = (token: string) =>
  call<{ studentName: string; completed: boolean }>({ action: 'invite_get', token });

/** Reads the invite token from the URL (and remembers it), falling back to the remembered one. */
export function resolvePlacementInviteToken(search: string): string | null {
  try {
    const fromUrl = new URLSearchParams(search).get('invite');
    if (fromUrl && PLACEMENT_REPORT_TOKEN_PATTERN.test(fromUrl)) {
      localStorage.setItem(PLACEMENT_INVITE_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const stored = localStorage.getItem(PLACEMENT_INVITE_STORAGE_KEY);
    return stored && PLACEMENT_REPORT_TOKEN_PATTERN.test(stored) ? stored : null;
  } catch { return null; }
}

export function clearPlacementInviteToken(): void {
  try { localStorage.removeItem(PLACEMENT_INVITE_STORAGE_KEY); } catch { /* storage unavailable */ }
}
