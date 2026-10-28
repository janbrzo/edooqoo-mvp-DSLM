/* eslint-disable @typescript-eslint/no-explicit-any -- worksheet JSON is untyped model output; callers narrow it */
/**
 * Single client loader for the content of a `worksheets` row.
 *
 * Mirrors the server rule: `ai_response` is parsed first (code fences and a BOM
 * are stripped); when it is missing or not a JSON object, `html_content` is used
 * if it holds a JSON object with an `exercises` array (a degraded read, the row
 * is repairable). It never throws.
 */

export type WorksheetContentSource = 'ai_response' | 'html_content' | 'none';

export type WorksheetContentFailure = 'no_content' | 'ai_response_unparsable' | 'html_content_unusable';

export interface LoadedWorksheetContent {
  /** Parsed worksheet JSON, or null when neither column holds usable content. */
  data: Record<string, any> | null;
  /** Column the content came from. */
  source: WorksheetContentSource;
  /** True when `ai_response` was unusable and `html_content` filled in. */
  degraded: boolean;
  /** Why the preferred column was not used (set when degraded or when data is null). */
  reason?: WorksheetContentFailure;
}

export interface WorksheetContentRow {
  ai_response?: unknown;
  html_content?: unknown;
}

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Removes a BOM and one surrounding markdown code fence (```json ... ```). */
export function stripCodeFence(text: string): string {
  let out = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trim();
  const fenced = out.match(/^```[a-zA-Z0-9_-]*[ \t]*\r?\n?([\s\S]*?)\r?\n?```$/);
  if (fenced) out = fenced[1].trim();
  return out;
}

/** Parses a JSON object from a string or accepts an already parsed object; null otherwise. */
export function parseJsonObject(value: unknown): Record<string, any> | null {
  if (isPlainObject(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed: unknown = JSON.parse(stripCodeFence(value));
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function loadWorksheetContent(row: WorksheetContentRow | null | undefined): LoadedWorksheetContent {
  if (!row) return { data: null, source: 'none', degraded: false, reason: 'no_content' };

  const hasAiResponse = typeof row.ai_response === 'string' ? row.ai_response.trim().length > 0 : isPlainObject(row.ai_response);
  const fromAi = parseJsonObject(row.ai_response);
  if (fromAi) return { data: fromAi, source: 'ai_response', degraded: false };

  const fromHtml = parseJsonObject(row.html_content);
  if (fromHtml && Array.isArray(fromHtml.exercises)) {
    return {
      data: fromHtml,
      source: 'html_content',
      degraded: hasAiResponse,
      ...(hasAiResponse ? { reason: 'ai_response_unparsable' as const } : {}),
    };
  }

  const hasHtml = typeof row.html_content === 'string' ? row.html_content.trim().length > 0 : isPlainObject(row.html_content);
  return {
    data: null,
    source: 'none',
    degraded: false,
    reason: hasAiResponse ? 'ai_response_unparsable' : hasHtml ? 'html_content_unusable' : 'no_content',
  };
}
