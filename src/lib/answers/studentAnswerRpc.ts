import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

/**
 * Student answer RPCs go through the *_by_share_token variants, which check the
 * link token and the assigned email server-side. Until the migration that adds
 * them is live everywhere, a "function not found" error falls back to the legacy
 * RPC with the same arguments, so a client shipped before the migration keeps
 * saving answers. Any other error (including a rejected token) is returned as is.
 */

export type TokenRpc =
  | 'save_homework_answer'
  | 'get_student_homework_answers'
  | 'save_worksheet_answer'
  | 'get_worksheet_student_answers';

/** null until the first token call answers; then whether the *_by_share_token RPCs exist. */
let tokenRpcAvailable: boolean | null = null;

/**
 * RPC name for fire-and-forget writes (beforeunload) that cannot retry on a
 * missing function. The token variant is used unless a call proved it missing:
 * the legacy names are revoked from client roles (20261012200100), so an
 * unknown state must not fall back to them.
 */
export const studentAnswerRpcName = (legacyName: TokenRpc, shareToken: string | null | undefined): string =>
  shareToken && tokenRpcAvailable !== false ? `${legacyName}_by_share_token` : legacyName;

const MISSING_FUNCTION_CODES = new Set(['PGRST202', '42883']);

export const isMissingRpcError = (error: { code?: string; message?: string } | null | undefined): boolean =>
  !!error &&
  (MISSING_FUNCTION_CODES.has(error.code ?? '') || /could not find the function/i.test(error.message ?? ''));

type RpcError = { code?: string; message?: string } | null;
type RpcResult<T> = { data: T | null; error: RpcError };
type RpcCall<T> = (fn: string, args: Record<string, unknown>) => Promise<RpcResult<T>>;

/** Rows returned by the legacy RPC (the token variant returns the same shape). */
export type StudentAnswerRpcRows<N extends TokenRpc> = Database['public']['Functions'][N]['Returns'];

export async function callStudentAnswerRpc<N extends TokenRpc>(
  legacyName: N,
  params: Record<string, unknown>,
  shareToken: string | null | undefined,
): Promise<RpcResult<StudentAnswerRpcRows<N>>> {
  // bind keeps `this` on the client object.
  const rpc = supabase.rpc.bind(supabase) as unknown as RpcCall<StudentAnswerRpcRows<N>>;
  if (shareToken && tokenRpcAvailable !== false) {
    const res = await rpc(`${legacyName}_by_share_token`, { p_share_token: shareToken, ...params });
    if (isMissingRpcError(res.error)) {
      tokenRpcAvailable = false;
    } else {
      // Only a real answer from the function proves it exists; a network error proves nothing.
      if (!res.error || res.error.code === '42501') tokenRpcAvailable = true;
      return res;
    }
  }
  return rpc(legacyName, params);
}

/** Call an RPC that is not in the generated types yet (added by a migration that may not be applied). */
export function callUntypedRpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<RpcResult<T>> {
  return (supabase.rpc.bind(supabase) as unknown as RpcCall<T>)(fn, args);
}
