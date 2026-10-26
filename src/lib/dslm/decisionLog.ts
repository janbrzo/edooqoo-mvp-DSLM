/**
 * Validation loop v1: fire-and-forget decision log (`log_dslm_decision` RPC,
 * table `dslm_decision_log`). It records what a teacher decided about a DSLM
 * signal (pacing proposal, level suggestion, AI raise) so the signal can be
 * validated later. It never throws, never blocks the UI, is skipped in demo
 * mode and goes quiet for the session when the RPC is not applied yet.
 */
import { callUntypedRpc, isMissingRpcError } from '@/lib/answers/studentAnswerRpc';
import { devWarn } from '@/utils/logger';

export type DslmDecisionType =
  | 'mark_done_prior_verdict'
  | 'ai_raise_applied'
  | 'ai_raise_reverted'
  | 'pacing_proposal_seen'
  | 'pacing_proposal_dismissed'
  | 'pacing_proposal_accepted'
  | 'level_suggestion_accepted'
  | 'level_suggestion_dismissed';

export interface DslmDecisionInput {
  studentId: string | null | undefined;
  type: DslmDecisionType;
  sourceId?: string | null;
  payload?: Record<string, unknown> | null;
}

type RpcFn = typeof callUntypedRpc;

/** Server cap is about 8 KB; stay below it. */
export const DECISION_PAYLOAD_MAX_CHARS = 6000;
const STRING_MAX_CHARS = 500;

const isDemoMode = (): boolean => {
  try { return localStorage.getItem('edooqoo_demo_mode') === 'true'; } catch { return false; }
};

/** Demo ids are not UUIDs; the server would reject them anyway. */
const isDemoStudentId = (id: string): boolean => id.startsWith('demo-');

const trimStrings = (value: unknown, depth = 0): unknown => {
  if (typeof value === 'string') return value.length > STRING_MAX_CHARS ? value.slice(0, STRING_MAX_CHARS) : value;
  if (depth > 4) return null;
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => trimStrings(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) out[k] = trimStrings(v, depth + 1);
    }
    return out;
  }
  return value;
};

/** Long strings are cut, and a payload over the cap is replaced by a marker instead of being sent. */
export function capDecisionPayload(payload: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!payload) return {};
  try {
    const trimmed = trimStrings(payload) as Record<string, unknown>;
    const size = JSON.stringify(trimmed).length;
    if (size <= DECISION_PAYLOAD_MAX_CHARS) return trimmed;
    return { truncated: true, original_chars: size };
  } catch {
    return { truncated: true };
  }
}

/** true once the server said the function does not exist; reset only by a reload. */
let rpcMissing = false;
const onceKeys = new Set<string>();

export const __resetDecisionLogForTests = () => {
  rpcMissing = false;
  onceKeys.clear();
};

/** Resolves to true when the row was stored; false on every other outcome. Never rejects. */
export async function logDslmDecision(input: DslmDecisionInput, rpc: RpcFn = callUntypedRpc): Promise<boolean> {
  try {
    if (!input.studentId || isDemoMode() || isDemoStudentId(input.studentId) || rpcMissing) return false;
    const { error } = await rpc('log_dslm_decision', {
      p_student_id: input.studentId,
      p_decision_type: input.type,
      p_source_id: input.sourceId ?? null,
      p_payload: capDecisionPayload(input.payload),
    });
    if (!error) return true;
    if (isMissingRpcError(error)) {
      rpcMissing = true;
      return false;
    }
    devWarn('[decisionLog] not stored', error.message ?? error);
    return false;
  } catch (e) {
    devWarn('[decisionLog] failed', e);
    return false;
  }
}

/** Same as logDslmDecision but only the first call per key in this browser session sends anything. */
export function logDslmDecisionOnce(key: string, input: DslmDecisionInput, rpc: RpcFn = callUntypedRpc): void {
  if (onceKeys.has(key)) return;
  onceKeys.add(key);
  void logDslmDecision(input, rpc);
}
