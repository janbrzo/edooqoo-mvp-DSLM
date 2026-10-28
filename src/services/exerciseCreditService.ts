import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { notifyTokenBalanceChanged } from '@/lib/worksheet/tokenBalanceEvents';
import { logClientError } from '@/services/clientErrorLogService';
import { devWarn } from '@/utils/logger';

/**
 * Client side of the per-exercise credit (0.1 token per exercise, Add Exercise
 * and Regenerate count one exercise each) charged by the `consume_exercise_credit`
 * RPC after a new exercise exists. The charge must never block the teacher: a
 * missing function, an RPC error or a network failure only gets logged.
 */

export type ExerciseCreditAction = 'add_exercise' | 'regenerate_exercise';

/**
 * - `charged`: the RPC charged the credit.
 * - `not_charged`: the RPC answered `charged: false` (the teacher is told calmly).
 * - `skipped`: demo mode, anonymous call or missing worksheet id (no RPC call).
 * - `unavailable`: the function is not deployed yet or the call failed (silent).
 */
export type ExerciseChargeStatus = 'charged' | 'not_charged' | 'skipped' | 'unavailable';

export interface ExerciseChargeResult {
  status: ExerciseChargeStatus;
  charged: boolean;
  tokensCharged: number;
  remainingCredit: number | null;
  reason: string | null;
}

export interface ChargeExerciseActionParams {
  worksheetId: string | null | undefined;
  action: ExerciseCreditAction;
  /** Exercises created by this action (default 1). */
  count?: number;
  /** Explicit demo flag; `edooqoo_demo_mode` in localStorage is always honoured too. */
  isDemo?: boolean;
}

const MISSING_FUNCTION_CODES = new Set(['PGRST202', '42883']);

/** Reasons that are not worth a message (the credit was already settled for this action). */
const SILENT_REASONS = new Set(['already_charged', 'duplicate', 'duplicate_action']);

export const NOT_CHARGED_TOAST_TITLE = 'Exercise ready, no credit used';
export const NOT_CHARGED_TOAST_DESCRIPTION =
  'Your exercise is in the worksheet. We could not apply the small credit for it this time, so nothing was deducted.';

const result = (
  status: ExerciseChargeStatus,
  extra: Partial<Omit<ExerciseChargeResult, 'status'>> = {},
): ExerciseChargeResult => ({
  status,
  charged: false,
  tokensCharged: 0,
  remainingCredit: null,
  reason: null,
  ...extra,
});

const isDemoStorage = (): boolean => {
  try {
    return localStorage.getItem('edooqoo_demo_mode') === 'true';
  } catch {
    return false;
  }
};

/** One fresh uuid per user action; the RPC uses it as the idempotency key. */
export function newActionRef(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const isMissingFunction = (error: { code?: string | null; message?: string | null }): boolean =>
  (!!error.code && MISSING_FUNCTION_CODES.has(error.code)) ||
  /could not find the function|function .* does not exist/i.test(error.message ?? '');

const asNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

function parsePayload(data: unknown): ExerciseChargeResult | null {
  const payload = Array.isArray(data) ? data[0] : data;
  if (typeof payload !== 'object' || payload === null) return null;
  const row = payload as Record<string, unknown>;
  if (typeof row.charged !== 'boolean') return null;
  return result(row.charged ? 'charged' : 'not_charged', {
    charged: row.charged,
    tokensCharged: asNumber(row.tokens_charged) ?? 0,
    remainingCredit: asNumber(row.remaining_credit),
    reason: typeof row.reason === 'string' && row.reason ? row.reason : null,
  });
}

/**
 * Charges the credit for one successful Add Exercise or Regenerate action.
 * Call it only after the new exercise exists. Never throws.
 */
export async function chargeExerciseAction(params: ChargeExerciseActionParams): Promise<ExerciseChargeResult> {
  const { worksheetId, action, isDemo } = params;
  const count = Number.isInteger(params.count) && (params.count as number) > 0 ? (params.count as number) : 1;

  if (!worksheetId || isDemo || isDemoStorage()) return result('skipped', { reason: 'skipped' });

  try {
    const { data, error } = await supabase.rpc(
      'consume_exercise_credit' as never,
      {
        p_worksheet_id: worksheetId,
        p_action_ref: newActionRef(),
        p_action: action,
        p_count: count,
      } as never,
    );

    if (error) {
      const failure = error as { code?: string | null; message?: string | null };
      if (isMissingFunction(failure)) {
        devWarn('[exerciseCredit] consume_exercise_credit is not deployed yet, no charge applied');
        return result('unavailable', { reason: 'function_missing' });
      }
      devWarn('[exerciseCredit] consume_exercise_credit failed', failure.code);
      void logClientError({
        sourceName: 'consume_exercise_credit',
        component: 'worksheets',
        message: 'consume_exercise_credit rpc_error',
        errorCode: failure.code ?? null,
        severity: 'warning',
        context: { worksheet_id: worksheetId, action, count },
      });
      return result('unavailable', { reason: 'rpc_error' });
    }

    const parsed = parsePayload(data);
    if (!parsed) {
      devWarn('[exerciseCredit] unexpected consume_exercise_credit payload');
      void logClientError({
        sourceName: 'consume_exercise_credit',
        component: 'worksheets',
        message: 'consume_exercise_credit unexpected_payload',
        severity: 'warning',
        context: { worksheet_id: worksheetId, action, count },
      });
      return result('unavailable', { reason: 'unexpected_payload' });
    }

    if (parsed.charged) {
      notifyTokenBalanceChanged();
    } else if (!parsed.reason || !SILENT_REASONS.has(parsed.reason)) {
      toast.info(NOT_CHARGED_TOAST_TITLE, { description: NOT_CHARGED_TOAST_DESCRIPTION });
      void logClientError({
        sourceName: 'consume_exercise_credit',
        component: 'worksheets',
        message: 'consume_exercise_credit not_charged',
        severity: 'warning',
        context: { worksheet_id: worksheetId, action, count, reason: parsed.reason },
      });
    }
    return parsed;
  } catch (e) {
    devWarn('[exerciseCredit] consume_exercise_credit threw', e);
    void logClientError({
      sourceName: 'consume_exercise_credit',
      component: 'worksheets',
      message: 'consume_exercise_credit rpc_threw',
      severity: 'warning',
      context: { worksheet_id: worksheetId, action, count },
    });
    return result('unavailable', { reason: 'rpc_threw' });
  }
}
