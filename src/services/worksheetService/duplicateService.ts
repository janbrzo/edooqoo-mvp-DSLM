import { supabase } from '@/integrations/supabase/client';
import { devLog, devWarn } from '@/utils/logger';

/**
 * Columns copied from the original. The list is explicit on purpose: a
 * `select('*')` spread also copied `public_slug` (unique, so duplicating any
 * published worksheet failed with a 409), `is_public`, share and view counters.
 * Publication, sharing, soft-delete and analytics columns are never copied.
 * `prompt` is not selected either (the client cannot read it); the copy gets a
 * neutral placeholder for the NOT NULL column.
 */
export const DUPLICATE_SOURCE_COLUMNS = [
  'title',
  'ai_response',
  'html_content',
  'form_data',
  'generation_time_seconds',
  'selected_image',
  'selected_audio',
  'audio_url',
  'audio_transcript',
  'audio_duration',
  'audio_voice',
  'media_metadata',
  'teacher_email',
  'user_id',
] as const;

/** `worksheets.prompt` is NOT NULL, but the original prompt is not readable by the client. */
export const DUPLICATE_PROMPT_PLACEHOLDER = 'Duplicated worksheet';

type SourceRow = Record<(typeof DUPLICATE_SOURCE_COLUMNS)[number], unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `form_data` of the copy: same inputs, but not the original's generation id (recovery looks rows up by it). */
function copyFormData(formData: unknown): unknown {
  if (!isRecord(formData)) return formData;
  const { clientGenerationId: _omitted, ...rest } = formData;
  void _omitted;
  return rest;
}

/**
 * Insert payload of a duplicate: explicit columns only, a private unshared copy
 * owned by the teacher, with the publication state reset.
 */
export function buildDuplicatePayload(
  original: Partial<SourceRow>,
  newStudentId: string | null,
  userId: string,
): Record<string, unknown> {
  const copied: Record<string, unknown> = {};
  for (const column of DUPLICATE_SOURCE_COLUMNS) {
    if (original[column] !== undefined) copied[column] = original[column];
  }

  return {
    ...copied,
    prompt: DUPLICATE_PROMPT_PLACEHOLDER,
    form_data: copyFormData(original.form_data),
    student_id: newStudentId,
    teacher_id: userId,
    status: 'copy',
    download_count: 0,
    is_public: false,
    public_slug: null,
    published_at: null,
    public_view_count: 0,
    deleted_at: null,
    share_token: null,
    share_expires_at: null,
    share_recipient_email: null,
    last_shared_at: null,
  };
}

const FRIENDLY_FAILURE = 'We could not duplicate this worksheet. Please try again in a moment.';

/** Maps a database error to a message a teacher can act on, without raw SQL text. */
export function friendlyDuplicateError(error: { code?: string; message?: string } | null | undefined): string {
  if (error?.code === '23505') {
    return 'This worksheet could not be copied because a unique value clashed. Please try again.';
  }
  if (error?.code === '42501') {
    return 'You do not have permission to duplicate this worksheet.';
  }
  return FRIENDLY_FAILURE;
}

/**
 * Duplicates a worksheet - creates a private copy with a new student assignment
 */
export async function duplicateWorksheetAPI(
  originalWorksheetId: string,
  newStudentId: string | null,
  userId: string
): Promise<{ success: boolean; worksheetId?: string; error?: string }> {
  try {
    devLog('Duplicating worksheet:', { originalWorksheetId, newStudentId });

    const { data: original, error: fetchError } = await supabase
      .from('worksheets')
      .select(DUPLICATE_SOURCE_COLUMNS.join(', '))
      .eq('id', originalWorksheetId)
      .eq('teacher_id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError) {
      devWarn('Duplicate: could not fetch original worksheet', fetchError.message);
      return { success: false, error: friendlyDuplicateError(fetchError) };
    }

    if (!original) {
      return { success: false, error: 'Worksheet not found or access denied' };
    }

    const duplicateData = buildDuplicatePayload(original as unknown as Partial<SourceRow>, newStudentId, userId);

    const { data: newWorksheet, error: insertError } = await supabase
      .from('worksheets')
      .insert(duplicateData as never)
      .select('id')
      .maybeSingle();

    if (insertError) {
      devWarn('Duplicate: insert failed', insertError.code, insertError.message);
      return { success: false, error: friendlyDuplicateError(insertError) };
    }

    if (!newWorksheet) {
      return { success: false, error: FRIENDLY_FAILURE };
    }

    devLog('Worksheet duplicated:', newWorksheet.id);
    return { success: true, worksheetId: newWorksheet.id };
  } catch (error) {
    devWarn('Duplicate worksheet error', error);
    return { success: false, error: FRIENDLY_FAILURE };
  }
}
