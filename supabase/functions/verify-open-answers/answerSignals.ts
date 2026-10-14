// Pure helpers for verify-open-answers: non-answer detection and model score parsing.
// No Deno-only imports so vitest can import this file.

const MAX_NON_ANSWER_CHARS = 25;
const MAX_NON_ANSWER_WORDS = 4;

// Each pattern must match the WHOLE (normalised) answer.
const NON_ANSWER_PATTERNS: RegExp[] = [
  /^i\s*don'?t\s*know$/,
  /^i\s*dont\s*know$/,
  /^idk$/,
  /^nie\s*wiem$/,
  /^no\s*idea$/,
  /^no\s*se$/,
  /^не\s*знаю$/,
  /^dunno$/,
  /^i\s*have\s*no\s*idea$/,
  /^i'?m?\s*not\s*sure$/,
  /^no\s*lo\s*se$/,
  /^je\s*ne\s*sais\s*pas$/,
  /^ich\s*wei(ss|ß)\s*nicht$/,
  /^não\s*sei$/,
  /^nwm$/,
  /^no\s*answer$/,
  /^n\/a$/,
  /^x+$/,
  /^nothing$/,
  /^none$/,
];

/**
 * True only when the whole trimmed answer is a non-answer ("idk", "I don't know", "?", "-", "n/a",
 * "nothing", "none", empty). Longer answers that merely start with such words are real answers.
 * Nonsense ("asdf qwer") and "test" are not non-answers: the model scores them.
 */
export function isNonAnswerText(raw: string | null | undefined): boolean {
  const text = (raw ?? "").toLowerCase().trim();
  if (text.length === 0) return true;
  if (text.length > MAX_NON_ANSWER_CHARS) return false;
  if (text.split(/\s+/).length > MAX_NON_ANSWER_WORDS) return false;
  // Trailing punctuation is allowed ("I don't know.", "idk!!").
  const stripped = text.replace(/[\s.!?,;:…]+$/u, "");
  if (stripped.length === 0) return true; // punctuation only: "?", "...", "!!"
  if (/^[-–—_]+$/.test(stripped)) return true; // dashes only
  return NON_ANSWER_PATTERNS.some((p) => p.test(stripped));
}

/**
 * Parses a model score into 0..1. Returns null (unevaluated) for anything unusable:
 * non-finite, negative, > 100, or text that is not a plain number, percentage or fraction.
 * 0..1 is taken as is; (1,100] and "85%" are divided by 100; "8/10" is 0.8.
 */
export function parseModelScore(value: unknown): number | null {
  if (typeof value === "number") return fromNumber(value);
  if (typeof value !== "string") return null;
  const s = value.trim().replace(",", ".");
  let m = s.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (m) return fromNumber(Number(m[1]), true);
  m = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (m) {
    const num = Number(m[1]);
    const den = Number(m[2]);
    if (!(den > 0) || num > den) return null;
    return num / den;
  }
  if (/^\d+(?:\.\d+)?$/.test(s)) return fromNumber(Number(s));
  return null;
}

function fromNumber(n: number, percent = false): number | null {
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  if (percent) return n / 100;
  return n <= 1 ? n : n / 100;
}
