// _shared/logError.ts
// Centralized error logger used by edge functions. Inserts a row into
// public.error_logs (RLS bypassed via service_role). Sanitizes context to
// strip secrets (authorization, password, token, apikey, cookie, jwt).
//
// Usage:
//   import { logError } from '../_shared/logError.ts';
//   await logError(supabase, {
//     source_name: 'update-student-self-profile',
//     component: 'auth',
//     message: err.message,
//     error_code: err.code,
//     stack: err.stack,
//     context: { teacherToken, studentEmail, fields: Object.keys(fields) },
//     user_id: studentId,
//   });

const SECRET_KEYS = [
  'authorization', 'auth', 'password', 'pass', 'token', 'apikey', 'api_key',
  'cookie', 'jwt', 'secret', 'service_role_key', 'access_token', 'refresh_token',
  'session', 'authorization_code',
];

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 1000 ? value.slice(0, 1000) + '…' : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEYS.some((s) => k.toLowerCase().includes(s))) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitize(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

export interface LogErrorParams {
  source_name: string;
  component: 'worksheets' | 'homework' | 'live' | 'calendar' | 'ai' | 'auth' | 'bug_report' | 'other';
  message: string;
  error_code?: string;
  stack?: string;
  context?: Record<string, unknown>;
  user_id?: string | null;
  severity?: 'warning' | 'error' | 'fatal';
  source?: 'edge_function' | 'client' | 'cron';
}

export async function logError(
  supabase: any,
  params: LogErrorParams,
): Promise<void> {
  try {
    const ctx = sanitize(params.context ?? {}) as Record<string, unknown>;
    await supabase.from('error_logs').insert({
      source: params.source ?? 'edge_function',
      source_name: params.source_name,
      severity: params.severity ?? 'error',
      component: params.component,
      message: (params.message ?? 'Unknown error').slice(0, 2000),
      error_code: params.error_code ?? null,
      stack: params.stack ? params.stack.slice(0, 8000) : null,
      context: ctx,
      user_id: params.user_id ?? null,
    });
  } catch (err) {
    // Logging must never throw — swallow.
    console.error('[logError] failed to insert error log:', err);
  }
}

/** Helper to extract a clean message from any error-shaped value. */
export function formatErr(err: unknown): { message: string; code?: string; stack?: string } {
  if (!err) return { message: 'Unknown error' };
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    return {
      message: (e.message as string) || (e.details as string) || JSON.stringify(e).slice(0, 500),
      code: (e.code as string) || undefined,
      stack: (e.stack as string) || undefined,
    };
  }
  return { message: String(err) };
}