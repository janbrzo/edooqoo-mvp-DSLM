/**
 * v6.9.48 — Auto-generate worksheet bootstrap helper.
 *
 * Reads sessionStorage flags written by DSLM PathwayView "Generate worksheet ↗"
 * suggestions and produces a complete `FormData` payload ready for
 * `handleGenerateWorksheet`. Used by `Index.tsx` mount effect to start the
 * generation deterministically, independent of `WorksheetForm`'s mount race.
 *
 * The mirror auto-fill logic (exercise auto-complete to reach 6 or 8 slots,
 * media-aware filtering) intentionally matches `WorksheetForm.submitForm` so
 * the AI prompt input stays identical regardless of which entrypoint fired.
 * The worksheet generation prompt and engine are NOT touched.
 */
import type { FormData, LessonTime, EnglishLevel, MediaType } from '@/components/WorksheetForm/types';

const PICTURE_COMPATIBLE = ['describe-picture', 'answer-questions-picture', 'true-false-picture', 'multiple-choice-picture'];
const AUDIO_COMPATIBLE = ['listening-comprehension', 'answer-questions-audio', 'true-false-audio', 'multiple-choice-audio', 'fill-in-blanks-audio'];
const GENERAL_EXERCISES = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'multiple-choice', 'dialogue', 'discussion', 'error-correction', 'odd-one-out', 'synonyms', 'antonyms', 'word-order', 'gap-text', 'negative-prefixes', 'categorize', 'paraphrasing', 'complete-word', 'matching-halves'];
const MANUAL_60 = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out', 'multiple-choice', 'discussion'];
const MANUAL_45 = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out'];

/**
 * v6.9.53 — Persistent auto-generate intent.
 *
 * Older versions stored the auto-generate request as several brittle
 * `sessionStorage` flags (`autoGenerateWorksheet`, `prefillWorksheet`, ...).
 * Any premature clear, mount-race, or refresh between StudentPage and Index
 * dropped the intent and the navigation looked like a no-op. v6.9.53 mirrors
 * the same payload into one `localStorage` object that the Index dispatcher
 * owns end-to-end. The legacy `sessionStorage` keys remain as a compatibility
 * fallback so existing entry points keep working unchanged.
 */
const PERSISTENT_INTENT_KEY = 'edooqoo.pendingWorksheetIntent';
const PERSISTENT_INTENT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type PersistentIntentStatus = 'pending' | 'firing' | 'completed' | 'failed';

export interface PersistentAutoGenerateIntent {
  requestId: string;
  studentId: string | null;
  suggestionId: string | null;
  topic: string;
  goal: string;
  additionalInfo: string;
  grammarFocus: string;
  exercises: string[];
  exerciseFocusMap: Record<string, 'vocabulary' | 'grammar'>;
  mediaTypes: MediaType[];
  createdAt: number;
  status: PersistentIntentStatus;
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    try { return crypto.randomUUID(); } catch { /* fall through */ }
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function inferMediaFromExercises(exercises: string[]): MediaType[] {
  const hasPic = exercises.some(id => PICTURE_COMPATIBLE.includes(id));
  const hasAud = exercises.some(id => AUDIO_COMPATIBLE.includes(id));
  if (hasPic) return ['picture'];
  if (hasAud) return ['audio'];
  return [];
}

export interface WriteAutoGenerateIntentInput {
  studentId: string | null;
  suggestionId?: string | null;
  topic: string;
  goal?: string;
  additionalInfo?: string;
  grammarFocus?: string;
  exercises?: string[];
  exerciseFocusMap?: Record<string, 'vocabulary' | 'grammar'>;
  mediaTypes?: MediaType[];
}

/**
 * Persist a full auto-generate intent AND mirror to legacy sessionStorage flags
 * so existing code paths (WorksheetForm hydration, etc.) keep functioning.
 */
export function writeAutoGenerateIntent(input: WriteAutoGenerateIntentInput): PersistentAutoGenerateIntent {
  const exercises = Array.isArray(input.exercises) ? input.exercises : [];
  const mediaTypes = input.mediaTypes && input.mediaTypes.length > 0
    ? input.mediaTypes
    : inferMediaFromExercises(exercises);
  const intent: PersistentAutoGenerateIntent = {
    requestId: generateRequestId(),
    studentId: input.studentId ?? null,
    suggestionId: input.suggestionId ?? null,
    topic: input.topic || '',
    goal: input.goal || '',
    additionalInfo: input.additionalInfo || '',
    grammarFocus: input.grammarFocus || '',
    exercises,
    exerciseFocusMap: input.exerciseFocusMap || {},
    mediaTypes,
    createdAt: Date.now(),
    status: 'pending',
  };

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PERSISTENT_INTENT_KEY, JSON.stringify(intent));
    } catch { /* ignore quota */ }

    try {
      sessionStorage.setItem('prefillWorksheet', JSON.stringify({
        topic: intent.topic,
        goal: intent.goal,
        additionalInfo: intent.additionalInfo,
        grammarFocus: intent.grammarFocus,
      }));
      if (intent.suggestionId) sessionStorage.setItem('prefillSuggestionId', intent.suggestionId);
      else sessionStorage.removeItem('prefillSuggestionId');
      if (exercises.length > 0) sessionStorage.setItem('prefillExercises', JSON.stringify(exercises));
      if (Object.keys(intent.exerciseFocusMap).length > 0) {
        sessionStorage.setItem('prefillExerciseFocusMap', JSON.stringify(intent.exerciseFocusMap));
      }
      sessionStorage.setItem('prefillMediaTypes', JSON.stringify(mediaTypes));
      sessionStorage.setItem('autoGenerateWorksheet', 'true');
      sessionStorage.setItem('autoGenerateWorksheetRequest', JSON.stringify({
        requestId: intent.requestId,
        studentId: intent.studentId,
        suggestionId: intent.suggestionId,
        createdAt: intent.createdAt,
        status: 'pending',
      }));
      sessionStorage.setItem('forceNewWorksheet', 'true');
    } catch { /* ignore quota */ }
  }

  return intent;
}

export function readPersistentAutoGenerateIntent(): PersistentAutoGenerateIntent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PERSISTENT_INTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistentAutoGenerateIntent;
    if (!parsed?.requestId || !parsed?.topic) return null;
    const age = Date.now() - (parsed.createdAt ?? 0);
    if (age > PERSISTENT_INTENT_TTL_MS) {
      window.localStorage.removeItem(PERSISTENT_INTENT_KEY);
      return null;
    }
    if (parsed.status === 'completed' || parsed.status === 'failed') {
      // Don't auto-fire again; caller may still introspect, but buildPayload
      // will skip it.
      return parsed;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function markPersistentAutoGenerateIntentStatus(
  requestId: string,
  status: PersistentIntentStatus,
): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(PERSISTENT_INTENT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistentAutoGenerateIntent;
    if (parsed.requestId !== requestId) return;
    parsed.status = status;
    window.localStorage.setItem(PERSISTENT_INTENT_KEY, JSON.stringify(parsed));
  } catch { /* ignore */ }
}

export function clearPersistentAutoGenerateIntent(): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(PERSISTENT_INTENT_KEY); } catch { /* ignore */ }
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export interface AutoGenerateIntent {
  requestId: string;
  studentId?: string;
  suggestionId?: string | null;
}

export function readAutoGenerateIntent(): AutoGenerateIntent | null {
  if (typeof window === 'undefined') return null;
  // v6.9.53 — persistent intent wins over legacy session flags.
  const persistent = readPersistentAutoGenerateIntent();
  if (persistent && persistent.status !== 'completed' && persistent.status !== 'failed') {
    return {
      requestId: persistent.requestId,
      studentId: persistent.studentId ?? undefined,
      suggestionId: persistent.suggestionId ?? null,
    };
  }
  try {
    if (sessionStorage.getItem('autoGenerateWorksheet') !== 'true') return null;
    const raw = sessionStorage.getItem('autoGenerateWorksheetRequest');
    const parsed = raw ? (JSON.parse(raw) as Partial<AutoGenerateIntent>) : null;
    if (!parsed?.requestId) return null;
    return {
      requestId: String(parsed.requestId),
      studentId: parsed.studentId ? String(parsed.studentId) : undefined,
      suggestionId: parsed.suggestionId ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * v6.9.49 — Cheap synchronous check used by Index mount-effect to decide
 * whether to wire the bootstrap interval at all (avoids polling cost when
 * the page was opened normally).
 */
export function hasAutoGenerateIntent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const persistent = readPersistentAutoGenerateIntent();
    if (persistent && persistent.status !== 'completed' && persistent.status !== 'failed') {
      return true;
    }
    return sessionStorage.getItem('autoGenerateWorksheet') === 'true';
  } catch {
    return false;
  }
}

/**
 * Build the FormData payload from sessionStorage prefill flags. Returns null
 * when there is no auto-generate intent or the prefilled lesson topic is empty
 * (we never start an empty AI generation).
 */
export function buildAutoGeneratePayload(): (FormData & { __autoGenerateRequestId: string }) | null {
  // v6.9.53 — prefer the persistent intent as the single source of truth.
  const persistent = readPersistentAutoGenerateIntent();
  const intent = readAutoGenerateIntent();
  if (!persistent && !intent) return null;
  if (persistent && (persistent.status === 'completed' || persistent.status === 'failed')) {
    return null;
  }

  const topic = (persistent?.topic
    || safeParse<{ topic?: string }>(sessionStorage.getItem('prefillWorksheet'), {}).topic
    || ''
  ).trim();
  if (!topic) return null;

  const goal = persistent?.goal
    || safeParse<{ goal?: string }>(sessionStorage.getItem('prefillWorksheet'), {}).goal
    || '';
  const additionalInfo = persistent?.additionalInfo
    || safeParse<{ additionalInfo?: string }>(sessionStorage.getItem('prefillWorksheet'), {}).additionalInfo
    || '';
  const grammarFocus = persistent?.grammarFocus
    || safeParse<{ grammarFocus?: string }>(sessionStorage.getItem('prefillWorksheet'), {}).grammarFocus
    || '';
  const exercises = (persistent?.exercises && persistent.exercises.length > 0
    ? persistent.exercises
    : safeParse<string[]>(sessionStorage.getItem('prefillExercises'), [])) || [];
  const focusMap = (persistent?.exerciseFocusMap && Object.keys(persistent.exerciseFocusMap).length > 0
    ? persistent.exerciseFocusMap
    : safeParse<Record<string, 'vocabulary' | 'grammar'>>(
        sessionStorage.getItem('prefillExerciseFocusMap'),
        {},
      )) || {};
  const mediaTypes = (persistent?.mediaTypes && persistent.mediaTypes.length > 0
    ? persistent.mediaTypes
    : safeParse<MediaType[]>(sessionStorage.getItem('prefillMediaTypes'), [])) || [];

  const requestId = persistent?.requestId || intent?.requestId || generateRequestId();
  const studentId = persistent?.studentId ?? intent?.studentId ?? undefined;
  const suggestionId = persistent?.suggestionId ?? intent?.suggestionId ?? null;

  // Default lesson time / level mirror WorksheetForm initial state.
  const lessonTime: LessonTime = '60min';
  const englishLevel: EnglishLevel = 'B1/B2';
  const is45 = (lessonTime as LessonTime) === '45min';
  const maxExercises = is45 ? 6 : 8;

  const seed = Array.isArray(exercises) && exercises.length > 0
    ? [...exercises]
    : (is45 ? [...MANUAL_45] : [...MANUAL_60]);

  const isPicture = mediaTypes.includes('picture');
  const isAudio = mediaTypes.includes('audio');

  let finalExercises = [...seed];
  if (finalExercises.length < maxExercises) {
    const unused = GENERAL_EXERCISES.filter(ex => {
      if (finalExercises.includes(ex)) return false;
      if (!isPicture && PICTURE_COMPATIBLE.includes(ex)) return false;
      if (!isAudio && AUDIO_COMPATIBLE.includes(ex)) return false;
      return true;
    });
    const shuffled = [...unused].sort(() => Math.random() - 0.5);
    finalExercises = [...finalExercises, ...shuffled.slice(0, maxExercises - finalExercises.length)];
  }

  const payload: FormData & { __autoGenerateRequestId: string } = {
    lessonTime,
    lessonTopic: topic,
    lessonGoal: goal,
    teachingPreferences: grammarFocus,
    additionalInformation: additionalInfo,
    englishLevel,
    languageStyle: 3,
    studentId: studentId,
    selectedExercises: finalExercises,
    selectedMediaTypes: mediaTypes,
    exerciseFocusMap: focusMap && Object.keys(focusMap).length > 0 ? focusMap : undefined,
    __autoGenerateFromSuggestion: true,
    __autoGenerateRequestId: requestId,
    // v6.9.53 — carry suggestionId in the payload so generation hook can
    // mark `is_used` even when sessionStorage gets cleared mid-flight.
    __autoGenerateSuggestionId: suggestionId,
  };
  return payload;
}

export interface ClearAutoGenerateFlagsOptions {
  preservePersistent?: boolean;
}

export function clearAutoGenerateFlags(options: ClearAutoGenerateFlagsOptions = {}): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem('autoGenerateWorksheet');
    sessionStorage.removeItem('autoGenerateWorksheetRequest');
  } catch {
    /* ignore */
  }
  if (!options.preservePersistent) {
    clearPersistentAutoGenerateIntent();
  }
}