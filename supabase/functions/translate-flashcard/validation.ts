/**
 * Pure input/output validators for translate-flashcard (no Deno or network
 * imports, so Vitest can load them like the other edge `_shared` modules).
 *
 * The function is reachable by teachers and by the Student Hub add-card dialog
 * (anon key), so every value that reaches the model is bounded and every
 * value that reaches a card is checked.
 */

export const MAX_TEXT_LENGTH = 200;
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];
export type TranslateMode = 'translation' | 'definition';

/**
 * Target languages: `NATIVE_LANGUAGES` in src/types/flashcards.ts plus
 * 'English' (parity-tested in translateFlashcardValidation.test.ts).
 */
export const ALLOWED_TARGET_LANGUAGES = [
  'Arabic', 'Bengali', 'Bulgarian', 'Catalan', 'Chinese', 'Croatian', 'Czech', 'Danish',
  'Dutch', 'English', 'Finnish', 'French', 'German', 'Greek', 'Hebrew', 'Hindi', 'Hungarian',
  'Indonesian', 'Italian', 'Japanese', 'Javanese', 'Korean', 'Malay', 'Marathi', 'Norwegian',
  'Persian', 'Polish', 'Portuguese', 'Punjabi', 'Romanian', 'Russian', 'Serbian', 'Slovak',
  'Slovenian', 'Spanish', 'Swahili', 'Swedish', 'Tagalog', 'Tamil', 'Telugu', 'Thai',
  'Turkish', 'Ukrainian', 'Urdu', 'Vietnamese',
] as const;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/;

export function validateText(raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string') return { ok: false, error: 'text must be a string' };
  const text = raw.trim();
  if (!text) return { ok: false, error: 'text must not be empty' };
  if (text.length > MAX_TEXT_LENGTH) {
    return { ok: false, error: `text must be at most ${MAX_TEXT_LENGTH} characters` };
  }
  if (CONTROL_CHARS.test(text)) return { ok: false, error: 'text must not contain control characters' };
  return { ok: true, value: text };
}

export function validateMode(raw: unknown): ValidationResult<TranslateMode> {
  if (raw === undefined || raw === null || raw === 'translation') return { ok: true, value: 'translation' };
  if (raw === 'definition') return { ok: true, value: 'definition' };
  return { ok: false, error: "mode must be 'translation' or 'definition'" };
}

/** Case-insensitive match against the allow-list; returns the canonical name. */
export function resolveTargetLanguage(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const wanted = raw.trim().toLowerCase();
  return ALLOWED_TARGET_LANGUAGES.find((l) => l.toLowerCase() === wanted) ?? null;
}

export interface TranslateRequest {
  text: string;
  mode: TranslateMode;
  targetLanguage: string;
}

/**
 * Definition mode always answers in English and ignores `target_language`
 * (older clients send 'English' or 'English definition').
 */
export function validateRequest(body: unknown): ValidationResult<TranslateRequest> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }
  const { text, target_language, mode } = body as Record<string, unknown>;
  const m = validateMode(mode);
  if (!m.ok) return { ok: false, error: (m as { error: string }).error };
  const t = validateText(text);
  if (!t.ok) return { ok: false, error: (t as { error: string }).error };
  if (m.value === 'definition') {
    return { ok: true, value: { text: t.value, mode: 'definition', targetLanguage: 'English' } };
  }
  const language = resolveTargetLanguage(target_language);
  if (!language) return { ok: false, error: 'target_language is not a supported language' };
  return { ok: true, value: { text: t.value, mode: 'translation', targetLanguage: language } };
}

/** Only A1..C2 survive; anything else (free text, wrong type) becomes null. */
export function normalizeCefr(raw: unknown): CefrLevel | null {
  if (typeof raw !== 'string') return null;
  const level = raw.trim().toUpperCase();
  return (CEFR_LEVELS as readonly string[]).includes(level) ? (level as CefrLevel) : null;
}

const REFUSAL_START = [
  /^i\s*(?:'|’)?m\s+(?:sorry|unable|not able)/i,
  /^i\s+am\s+(?:sorry|unable|not able)/i,
  /^i\s+(?:cannot|can\s*not|can't|can’t|won't|won’t|couldn't)\b/i,
  /^sorry\b/i,
  /^unfortunately\b/i,
  /^no\s+puedo\b/i,
  /^lo\s+siento\b/i,
  /^no\s+(?:me\s+)?es\s+posible\b/i,
  /^je\s+(?:ne\s+peux|suis\s+d[ée]sol[ée])/i,
  /^es\s+tut\s+mir\s+leid/i,
  /^ich\s+kann\s+(?:das\s+)?nicht\b/i,
  /^przepraszam/i,
  /^nie\s+mog[eę]\b/i,
];
const REFUSAL_ANYWHERE = [
  /\bas\s+an?\s+ai\b/i,
  /\blanguage\s+model\b/i,
  /\bcomo\s+(?:una\s+)?ia\b/i,
  /\bi\s+(?:cannot|can't|can’t|am\s+unable\s+to)\s+(?:process|help|assist|translate|comply)/i,
  /\bno\s+puedo\s+(?:procesar|ayudar|traducir|cumplir)/i,
];

// A sentence that merely STARTS like an apology ("Przepraszam, gdzie jest
// stacja?", "No puedo dormir por la noche") is a translation. A start phrase
// counts as a refusal only when it also talks about the request itself.
const REFUSAL_CONTINUATION =
  /translat|traduc|tradu[ií]|übersetz|przetłumacz|\bhelp|ayud|\bhilf|\baider\b|pomóc|pomoc|\bassist\b|\bassisting\b|\bthat\b|(?:this|your|that|esta|esa|su|tu|diese|deine)\s+(?:request|solicitud|petici[óo]n|anfrage|prośb\w*)|content|contenido|inhalt|treść|instruc|anweisung|polece|\bAI\b|\bIA\b|comply|cumplir|provide|proporcion|fulfil|process|procesar|respond|answer|understand|entiendo|verstehe|rozumiem/i;

const INPUT_REFUSAL_CUE = /\b(can't|can’t|cannot|can not|won't|sorry|unable|unfortunately|AI|language model)\b/i;

export type TranslationRejection = 'empty' | 'refusal' | 'too_long' | 'format' | 'not_text';

/**
 * Decide whether the model output is a usable translation or definition.
 * Returns null when it is fine, or the reason it must not reach a card.
 * Short refusal-like phrases ("I can't" -> "No puedo") stay valid.
 */
export function rejectTranslation(
  translation: string,
  input: string,
  mode: TranslateMode,
): TranslationRejection | null {
  const out = translation.trim();
  if (!out) return 'empty';
  if (/[\r\n]/.test(out) || out.includes('```') || /^[{[]/.test(out)) return 'format';
  if (!/\p{L}/u.test(out)) return 'not_text';
  const maxLength = mode === 'definition' ? 300 : input.length * 3 + 40;
  if (out.length > maxLength) return 'too_long';
  const unquoted = out.replace(/^["'“”‘’«»]+/, '');
  const startsLikeRefusal = REFUSAL_START.some((re) => re.test(unquoted));
  // Refusals are sentences about the request. A short phrase, or an output
  // for an input that itself says "can't"/"sorry", is a genuine translation.
  const sentenceLike = out.split(/\s+/).length >= 4;
  const inputHasCue = INPUT_REFUSAL_CUE.test(input);
  if (REFUSAL_ANYWHERE.some((re) => re.test(out)) && sentenceLike && !inputHasCue) return 'refusal';
  if (startsLikeRefusal && sentenceLike && !inputHasCue && REFUSAL_CONTINUATION.test(out)) return 'refusal';
  return null;
}

export interface ParsedModelOutput {
  translation: string | null;
  cefr_level: CefrLevel | null;
}

/** Parse the model's JSON, fall back to plain text, then validate. */
export function parseModelOutput(content: string, input: string, mode: TranslateMode): ParsedModelOutput {
  let translation = '';
  let cefr: unknown = null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      translation = typeof parsed.translation === 'string' ? parsed.translation : '';
      cefr = parsed.cefr_level;
    }
  } catch {
    translation = content;
  }
  translation = translation.trim();
  if (rejectTranslation(translation, input, mode)) return { translation: null, cefr_level: null };
  return { translation, cefr_level: normalizeCefr(cefr) };
}

/** Fixed-window limiter for unauthenticated callers. Mutates `hits`. */
export function allowRequest(
  hits: Map<string, { start: number; count: number }>,
  key: string,
  now: number,
  limit: number,
  windowMs: number,
): boolean {
  const entry = hits.get(key);
  if (!entry || now - entry.start >= windowMs) {
    if (hits.size > 5000) {
      // Bounded memory: drop expired windows first, reset only if still full.
      for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
      if (hits.size > 5000) hits.clear();
    }
    hits.set(key, { start: now, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}
