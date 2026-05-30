/**
 * Strips system-facing question IDs (wt_q3c, q45, etc.) from AI-generated text
 * so teachers don't see raw identifiers in summaries, recommendations or
 * observations. The model is also instructed to avoid IDs, but this is the
 * runtime safety net for legacy summaries already persisted in DB.
 */
const ID_TOKEN_RE = /\(?(?:wt_)?q\d+[a-z]?\)?/gi;
const FILLER_RE = /\b(?:in|from|on|at|for|via)\s*(?=[,.;:]|\s|$)/gi;
const MULTI_SPACE_RE = /\s{2,}/g;
const SPACE_BEFORE_PUNCT_RE = /\s+([.,;:!?])/g;

export function sanitizeAiText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(ID_TOKEN_RE, "")
    .replace(FILLER_RE, "")
    .replace(SPACE_BEFORE_PUNCT_RE, "$1")
    .replace(MULTI_SPACE_RE, " ")
    .trim();
}

export function sanitizeAiList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => sanitizeAiText(String(x))).filter(Boolean);
}