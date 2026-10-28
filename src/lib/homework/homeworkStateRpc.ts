/**
 * RPCs of the homework lifecycle that the generated Supabase types do not list yet:
 * the student status read (with completed_by_teacher) and the teacher's reopen.
 */
import { supabase } from '@/integrations/supabase/client';

type RpcError = { code?: string; message?: string } | null;
type RpcCall<T> = (fn: string, args: Record<string, unknown>) => Promise<{ data: T | null; error: RpcError }>;

const rpc = <T>() => supabase.rpc.bind(supabase) as unknown as RpcCall<T>;

export interface HomeworkStateRow {
  id: string;
  reviewed_at: string | null;
  completed_at: string | null;
  completed_by_teacher: boolean;
  source_worksheet_id: string | null;
}

/** Student-side status of a homework by its share token (null when the link is unknown). */
export async function fetchHomeworkState(shareToken: string): Promise<HomeworkStateRow | null> {
  const { data, error } = await rpc<HomeworkStateRow[] | HomeworkStateRow>()('get_homework_state_by_share_token', { p_share_token: shareToken });
  if (error || !data) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export interface LifecycleResult {
  success?: boolean;
  error?: string;
  already_completed?: boolean;
}

/** Teacher undoes "Mark done"; only a teacher close can be reopened. */
export async function reopenHomework(homeworkId: string): Promise<LifecycleResult> {
  const { data, error } = await rpc<LifecycleResult>()('reopen_homework', { p_homework_id: homeworkId });
  if (error) throw error;
  return data ?? { success: false, error: 'No response' };
}

/** True when a submit was refused because the teacher closed the homework. */
export const isHomeworkClosedError = (error: { message?: string } | null | undefined): boolean =>
  !!error?.message && error.message.includes('homework_closed');

/** What a teacher's "Mark done" call achieved; the RPC reports a refusal as success:false, not as an error. */
export function markDoneOutcome(result: LifecycleResult | null | undefined): { kind: 'done' | 'already' | 'error'; message?: string } {
  if (!result?.success) return { kind: 'error', message: result?.error || 'Failed to mark homework as done' };
  if (result.already_completed) return { kind: 'already' };
  return { kind: 'done' };
}

/** 42501: the server no longer accepts this e-mail for this homework (the address was edited or the homework deleted). */
export const isAccessRevokedError = (error: { code?: string } | null | undefined): boolean =>
  !!error && error.code === '42501';
