/**
 * Server-side loader for the generated worksheet JSON (exercises, titles, media keys).
 *
 * `worksheets.ai_response` is the raw model text and is not always parseable JSON
 * (27 of 1107 production rows at audit time). `worksheets.html_content` holds the
 * normalised JSON until the first owner edit, after which it holds HTML. Every
 * server consumer reads the content only through `loadWorksheetJson`, so a row with
 * a broken `ai_response` still resolves from `html_content` when that is JSON.
 * Pure, never throws, no path aliases (imported by vitest and Deno).
 */

export type WorksheetJsonSource = 'ai_response' | 'html_content';

export interface LoadedWorksheetJson {
  /** Parsed worksheet object, or null when neither column holds usable JSON. */
  data: any | null;
  /** Column the data came from; null when nothing was usable. */
  source: WorksheetJsonSource | null;
  /** True whenever the data did not come from `ai_response` (fallback used or nothing usable). */
  degraded: boolean;
}

export interface WorksheetContentRow {
  id?: string | null;
  ai_response?: unknown;
  html_content?: unknown;
}

const isPlainObject = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** Parses a JSON string (or accepts an already parsed jsonb value); undefined when unusable. */
function parseJsonValue(raw: unknown, tolerateFences: boolean): unknown {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== 'string') return raw;
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch { /* try the fence-stripped form below */ }
  if (!tolerateFences) return undefined;
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  if (stripped === raw.trim()) return undefined;
  try {
    return JSON.parse(stripped);
  } catch {
    return undefined;
  }
}

/**
 * Worksheet JSON of a row: `ai_response` first, then `html_content` when that is a
 * JSON object with an `exercises` array. Behaviour for a row whose `ai_response`
 * already parses to an object is identical to a bare `JSON.parse`.
 */
export function loadWorksheetJson(row: WorksheetContentRow | null | undefined): LoadedWorksheetJson {
  try {
    if (!row) return { data: null, source: null, degraded: true };
    const primary = parseJsonValue(row.ai_response, true);
    if (isPlainObject(primary)) return { data: primary, source: 'ai_response', degraded: false };

    const fallback = parseJsonValue(row.html_content, false);
    if (isPlainObject(fallback) && Array.isArray(fallback.exercises)) {
      console.warn(`[worksheetContent] ai_response unusable, using html_content (worksheet ${String(row.id ?? 'unknown')})`);
      return { data: fallback, source: 'html_content', degraded: true };
    }

    const hadContent = typeof row.ai_response === 'string' ? row.ai_response.trim().length > 0 : row.ai_response != null;
    if (hadContent) {
      console.warn(`[worksheetContent] no parseable worksheet JSON (worksheet ${String(row.id ?? 'unknown')})`);
    }
    return { data: null, source: null, degraded: true };
  } catch (e) {
    console.error('[worksheetContent] loader failed:', (e as Error)?.message);
    return { data: null, source: null, degraded: true };
  }
}

const nonEmptyString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : null;

function transcriptOf(audio: unknown): string | null {
  if (typeof audio === 'string') {
    const parsed = parseJsonValue(audio, false);
    return isPlainObject(parsed) ? nonEmptyString(parsed.transcript) : null;
  }
  return isPlainObject(audio) ? nonEmptyString(audio.transcript) : null;
}

/**
 * Lesson audio transcript of a worksheet. The generation engine stores it in the
 * `audio_transcript` / `selected_audio` COLUMNS; the JSON keys exist only on rows
 * the editor rewrote, so the columns win and the JSON is the fallback.
 */
export function resolveAudioTranscript(
  row: { audio_transcript?: unknown; selected_audio?: unknown } | null | undefined,
  json: any,
): string | null {
  return nonEmptyString(row?.audio_transcript)
    ?? transcriptOf(row?.selected_audio)
    ?? nonEmptyString(json?.audio_transcript)
    ?? transcriptOf(json?.selected_audio);
}
