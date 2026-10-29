/**
 * Client side of the translate-flashcard contract.
 *
 * The function answers HTTP 200 with `{ translation: null, error:
 * 'translation_unavailable' }` when the model refused or returned junk, and
 * 400/429/500 (thrown by `supabase.functions.invoke`) for rejected input.
 * Callers use `readTranslationResult` so an unusable result is never written
 * into a card; manual entry always stays possible.
 */
export const MAX_TRANSLATE_TEXT_LENGTH = 200;

const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export interface TranslationResult {
  translation: string;
  cefrLevel: string | null;
}

/** Returns null when the response carries no usable translation. */
export function readTranslationResult(data: unknown): TranslationResult | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { translation?: unknown; cefr_level?: unknown; error?: unknown };
  if (d.error || typeof d.translation !== 'string') return null;
  const translation = d.translation.trim();
  if (!translation) return null;
  const level = typeof d.cefr_level === 'string' ? d.cefr_level.trim().toUpperCase() : '';
  return { translation, cefrLevel: CEFR.has(level) ? level : null };
}

/** True when the text may be sent to translate-flashcard (non-empty, within the cap). */
export function canTranslate(text: string): boolean {
  const t = (text || '').trim();
  return t.length > 0 && t.length <= MAX_TRANSLATE_TEXT_LENGTH;
}

export const TRANSLATION_UNAVAILABLE_MESSAGE =
  'Could not suggest a translation for this text. You can type it manually.';
