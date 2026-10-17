/**
 * Rows of the "recent worksheets" block sent to the DSLM planners.
 *
 * `worksheets` has no `topic` column: the topic is `form_data.lessonTopic`
 * (present on every worksheet) and the title is the fallback. Selecting the
 * missing column made the whole query fail, so the planners never saw what a
 * student had already been taught.
 */
export const WORKSHEET_HISTORY_COLUMNS = 'title, form_data, created_at';

export interface WorksheetHistoryRow {
  topic: string;
  created_at: string;
}

export function toWorksheetHistoryRows(
  rows: ReadonlyArray<{ title?: unknown; form_data?: unknown; created_at?: unknown }> | null | undefined,
): WorksheetHistoryRow[] {
  const out: WorksheetHistoryRow[] = [];
  for (const row of rows ?? []) {
    const form = row.form_data && typeof row.form_data === 'object' ? (row.form_data as Record<string, unknown>) : {};
    const lessonTopic = typeof form.lessonTopic === 'string' ? form.lessonTopic.trim() : '';
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const topic = lessonTopic || title;
    if (!topic || typeof row.created_at !== 'string') continue;
    out.push({ topic: topic.slice(0, 200), created_at: row.created_at });
  }
  return out;
}
