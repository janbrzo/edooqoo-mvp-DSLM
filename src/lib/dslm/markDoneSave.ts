/**
 * save_mark_done_evaluation with the optional `p_prior_verdict` argument
 * (validation loop v1). Falls back to the old signature when the server says
 * the function with that argument does not exist yet, so a client shipped
 * before the migration keeps saving Mark done.
 */
import { callUntypedRpc, isMissingRpcError } from '@/lib/answers/studentAnswerRpc';
import type { PriorVerdict } from './priorVerdict';

type RpcFn = typeof callUntypedRpc;

/** false once the server proved the 7-argument signature missing; reset only by a reload. */
let priorArgAvailable = true;
export const __resetMarkDoneSaveForTests = () => { priorArgAvailable = true; };

export async function saveMarkDoneEvaluationRpc(
  args: Record<string, unknown>,
  priorVerdict: PriorVerdict | null | undefined,
  rpc: RpcFn = callUntypedRpc,
) {
  if (priorVerdict && priorArgAvailable) {
    const res = await rpc('save_mark_done_evaluation', { ...args, p_prior_verdict: priorVerdict });
    if (!isMissingRpcError(res.error)) return res;
    priorArgAvailable = false;
  }
  return rpc('save_mark_done_evaluation', args);
}
