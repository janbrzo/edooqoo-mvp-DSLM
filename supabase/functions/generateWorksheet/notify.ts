// ============================================================
// FAILURE NOTIFICATION HELPER
// Sends email alert on any failed worksheet generation
// ============================================================
export async function notifyGenerationFailure(errorType: string, errorMessage: string, context: Record<string, any>) {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    await fetch(`${supabaseUrl}/functions/v1/notify-generation-failure`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ errorType, errorMessage, timestamp: new Date().toISOString(), ...context }),
    });
    console.log(`📧 Failure notification sent: ${errorType}`);
  } catch (e) {
    console.error("Failed to send failure notification email:", e);
  }
}

export function classifyErrorType(error: Error | unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes('quota') || msg.includes('429') || msg.includes('Too Many Requests')) return 'quota';
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('deadline')) return 'timeout';
  if (msg.includes('JSON') || msg.includes('parse') || msg.includes('Unexpected token')) return 'parse';
  return 'network';
}

/**
 * Keeps the worker alive for a detached promise when the runtime provides
 * EdgeRuntime.waitUntil; does nothing otherwise.
 */
export function waitUntilIfAvailable(promise: Promise<unknown>): void {
  try {
    // @ts-ignore - EdgeRuntime is a Deno Deploy global
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(promise);
    }
  } catch (_) { /* ignore */ }
}

/**
 * EdgeRuntime.waitUntil keeps the promise alive even after the response
 * stream is closed (otherwise Deno Deploy kills it); without the runtime the
 * promise is awaited here.
 */
export async function waitUntilOrAwait(promise: Promise<unknown>): Promise<void> {
  try {
    // @ts-ignore - EdgeRuntime is a Deno Deploy global
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(promise);
    } else {
      await promise;
    }
  } catch (_) { /* ignore */ }
}
