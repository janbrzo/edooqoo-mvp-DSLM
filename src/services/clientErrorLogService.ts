import { supabase } from '@/integrations/supabase/client';
import { devWarn } from '@/utils/logger';

/**
 * Best-effort client error reporting into `public.error_logs`.
 *
 * RLS only lets authenticated users INSERT rows with `source = 'client'`, so the
 * insert never asks for the row back (no RETURNING). It never throws, never
 * blocks the caller and sends no free text: only ids, codes and short reasons.
 */

export type ClientErrorComponent = 'worksheets' | 'homework' | 'live' | 'calendar' | 'ai' | 'auth' | 'other';

export interface ClientErrorParams {
  sourceName: string;
  component: ClientErrorComponent;
  message: string;
  errorCode?: string | null;
  severity?: 'warning' | 'error' | 'fatal';
  userId?: string | null;
  /** Ids, flags and short reasons only (never learner or teacher text). */
  context?: Record<string, string | number | boolean | null | undefined>;
}

const MAX_DEDUPE_KEYS = 200;
const reported = new Set<string>();

const clip = (value: string, max: number) => (value.length > max ? value.slice(0, max) : value);

/** Sends one row; identical (source, message, context) pairs are reported once per page session. */
export async function logClientError(params: ClientErrorParams): Promise<void> {
  try {
    const context: Record<string, string | number | boolean | null> = {};
    for (const [key, value] of Object.entries(params.context ?? {})) {
      if (value === undefined) continue;
      context[clip(key, 64)] = typeof value === 'string' ? clip(value, 200) : value;
    }

    const dedupeKey = `${params.sourceName}|${params.message}|${JSON.stringify(context)}`;
    if (reported.has(dedupeKey)) return;
    if (reported.size >= MAX_DEDUPE_KEYS) reported.clear();
    reported.add(dedupeKey);

    const { error } = await supabase.from('error_logs').insert({
      source: 'client',
      source_name: clip(params.sourceName, 120),
      component: params.component,
      severity: params.severity ?? 'error',
      message: clip(params.message, 300),
      error_code: params.errorCode ? clip(params.errorCode, 64) : null,
      context,
      user_id: params.userId ?? null,
    });
    if (error) devWarn('[clientErrorLog] insert rejected', error.code);
  } catch (e) {
    devWarn('[clientErrorLog] insert threw', e);
  }
}

/** Test helper: forget what was already reported. */
export function resetClientErrorLogDedupe(): void {
  reported.clear();
}

export type TokenChargeFailureReason = 'rpc_error' | 'rpc_returned_false' | 'rpc_threw';

/**
 * A `consume_token` call that errored or returned `false`: the worksheet stays
 * delivered, the failed charge is recorded so billing monitoring can see it.
 */
export function logTokenChargeFailure(args: {
  worksheetId: string;
  reason: TokenChargeFailureReason;
  origin: 'generation_hook' | 'job_poller';
  userId?: string | null;
  errorCode?: string | null;
}): Promise<void> {
  return logClientError({
    sourceName: 'consume_token',
    component: 'worksheets',
    message: `consume_token ${args.reason}`,
    errorCode: args.errorCode ?? null,
    severity: 'error',
    userId: args.userId ?? null,
    context: { worksheet_id: args.worksheetId, reason: args.reason, origin: args.origin },
  });
}
