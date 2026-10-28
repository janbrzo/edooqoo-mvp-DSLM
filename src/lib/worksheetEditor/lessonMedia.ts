/**
 * Lesson media of a worksheet (the image or the listening audio shared by the
 * whole lesson), derived at read time and never written back into the
 * worksheet JSON.
 *
 * Why: the owner view used to inject `selected_image` / `selected_audio` /
 * `audio_url` from the row columns into the editable JSON on mount, which the
 * autosave then persisted as if the teacher had edited the worksheet.
 *
 * Source order (first non-empty wins, per medium):
 * 1. worksheet row columns (`selected_image`, `selected_audio`, `audio_url`, `audio_*`)
 * 2. `form_data.selectedImage` / `form_data.selectedAudio`
 * 3. keys inside the worksheet JSON (legacy rows written by the old inject effect)
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- media objects are untyped JSON stored in worksheets and form_data */

export interface LessonMediaColumns {
  selected_image?: unknown;
  selected_audio?: unknown;
  audio_url?: string | null;
  audio_transcript?: string | null;
  audio_duration?: number | null;
  audio_voice?: string | null;
}

export interface LessonMedia {
  /** Image object as stored (`url`, `description`, `ai_generated_url`, ...). */
  selectedImage: any | null;
  /** Audio object with at least one playable url, transcript/duration/voice filled from flat fields. */
  selectedAudio: any | null;
  /** Flat audio url, when any source carries one. */
  audioUrl: string | null;
  audioTranscript: string | null;
  hasImage: boolean;
  hasAudio: boolean;
}

export const EMPTY_LESSON_MEDIA: LessonMedia = Object.freeze({
  selectedImage: null,
  selectedAudio: null,
  audioUrl: null,
  audioTranscript: null,
  hasImage: false,
  hasAudio: false,
});

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const pickImage = (value: unknown): Record<string, any> | null => {
  if (!isObject(value)) return null;
  return nonEmptyString(value.url) || nonEmptyString(value.ai_generated_url) || nonEmptyString(value.unsplash_url)
    ? value
    : null;
};

interface AudioSource {
  selected_audio?: unknown;
  audio_url?: unknown;
  audio_transcript?: unknown;
  audio_duration?: unknown;
  audio_voice?: unknown;
}

const audioFromSource = (source: AudioSource): Record<string, any> | null => {
  const selected = isObject(source.selected_audio) ? source.selected_audio : null;
  const flatUrl = nonEmptyString(source.audio_url);
  const selectedUrl = selected ? nonEmptyString(selected.url) || nonEmptyString(selected.ai_generated_audio_url) : null;

  const url = selectedUrl || flatUrl;
  if (!url) return null;

  const base: Record<string, any> =
    selected && selectedUrl
      ? { ...selected }
      : {
          ...(selected ?? {}),
          url,
          ai_generated_audio_url: url,
          source: selected?.source ?? 'database-reconstructed',
        };

  if (base.transcript == null && typeof source.audio_transcript === 'string') base.transcript = source.audio_transcript;
  if (base.duration == null && typeof source.audio_duration === 'number') base.duration = source.audio_duration;
  if (base.voice == null && typeof source.audio_voice === 'string') base.voice = source.audio_voice;
  return base;
};

export interface ResolveLessonMediaInput {
  columns?: LessonMediaColumns | null;
  formData?: unknown;
  worksheetJson?: unknown;
}

export function resolveLessonMedia({ columns, formData, worksheetJson }: ResolveLessonMediaInput): LessonMedia {
  const form = isObject(formData) ? formData : {};
  const json = isObject(worksheetJson) ? worksheetJson : {};
  const cols = columns ?? {};

  const selectedImage =
    pickImage(cols.selected_image) ?? pickImage(form.selectedImage) ?? pickImage(json.selected_image);

  const selectedAudio =
    audioFromSource(cols) ??
    audioFromSource({ selected_audio: form.selectedAudio }) ??
    audioFromSource(json);

  const audioUrl = selectedAudio
    ? nonEmptyString(selectedAudio.ai_generated_audio_url) || nonEmptyString(selectedAudio.url)
    : null;
  const audioTranscript = selectedAudio ? nonEmptyString(selectedAudio.transcript) : null;

  return {
    selectedImage,
    selectedAudio,
    audioUrl,
    audioTranscript,
    hasImage: selectedImage !== null,
    hasAudio: selectedAudio !== null,
  };
}

/**
 * The stored title column is what the teacher sees in lists and what a rename
 * from a list changes; the JSON title can lag behind it. The editor starts from
 * the column title so a later real edit never writes the stale JSON title back.
 */
export function withColumnTitle<T extends Record<string, any> | null>(worksheet: T, columnTitle: unknown): T {
  if (!worksheet || typeof worksheet !== 'object') return worksheet;
  const title = typeof columnTitle === 'string' ? columnTitle.trim() : '';
  if (!title || worksheet.title === title) return worksheet;
  return { ...worksheet, title };
}
