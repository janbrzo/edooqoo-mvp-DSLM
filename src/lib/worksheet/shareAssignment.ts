/**
 * Shared worksheet: is the worksheet known to have no assigned student?
 *
 * Anonymous students cannot read the `worksheets` row (RLS), so a missing row
 * means "unknown", never "unassigned". Only a readable row without `student_id`
 * counts as unassigned; access for everyone else is decided server-side by
 * `verify_worksheet_student_email`.
 */
export const isKnownUnassigned = (row: { student_id?: string | null } | null | undefined): boolean =>
  !!row && !row.student_id;
