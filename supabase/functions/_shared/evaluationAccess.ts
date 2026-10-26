/**
 * Who may trigger AI evaluation of student answers.
 *
 * verify-open-answers and process-pending-ai-evaluations spend AI credits and
 * write evaluation results, so they are never open to anonymous callers:
 *   - service: another edge function or a cron job (service role key)
 *   - user:    a signed-in user (teacher, including anonymous trial accounts)
 *   - student: an anonymous student who proves access to one homework or one
 *              shared worksheet with its share token plus their assigned email
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { Caller } from "./auth.ts";

export interface StudentAccessClaim {
  share_token?: unknown;
  student_email?: unknown;
}

const asText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Homework id when the share token + email pair is valid, else null. */
export async function homeworkIdForStudentAccess(
  admin: SupabaseClient,
  claim: StudentAccessClaim | null | undefined,
): Promise<string | null> {
  const token = asText(claim?.share_token);
  const email = asText(claim?.student_email).toLowerCase();
  if (!token || !email) return null;
  const { data: hw } = await admin
    .from("homework_assignments")
    .select("id")
    .eq("share_token", token)
    .maybeSingle();
  if (!hw?.id) return null;
  const { data: ok } = await admin.rpc("verify_homework_student_email", {
    p_homework_id: hw.id,
    p_email: email,
  });
  return ok === true ? hw.id : null;
}

/** True when the share token belongs to this worksheet and the email is its assigned student. */
export async function hasWorksheetStudentAccess(
  admin: SupabaseClient,
  worksheetId: string | null,
  claim: StudentAccessClaim | null | undefined,
): Promise<boolean> {
  const token = asText(claim?.share_token);
  const email = asText(claim?.student_email).toLowerCase();
  if (!worksheetId || !token || !email) return false;
  const { data: ws } = await admin
    .from("worksheets")
    .select("id")
    .eq("id", worksheetId)
    .eq("share_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (!ws?.id) return false;
  const { data: ok } = await admin.rpc("verify_worksheet_student_email", {
    p_worksheet_id: worksheetId,
    p_email: email,
  });
  return ok === true;
}

/** True when the signed-in user owns the worksheet. */
export async function userOwnsWorksheet(
  admin: SupabaseClient,
  caller: Caller,
  worksheetId: string | null,
): Promise<boolean> {
  if (caller.kind !== "user" || !worksheetId) return false;
  const uid = caller.user.id;
  const { data: ws } = await admin
    .from("worksheets")
    .select("id")
    .eq("id", worksheetId)
    .or(`teacher_id.eq.${uid},user_id.eq.${uid}`)
    .maybeSingle();
  return !!ws?.id;
}

/** True when the signed-in user is the teacher who owns the homework. */
export async function userOwnsHomework(
  admin: SupabaseClient,
  caller: Caller,
  homeworkId: string | null,
): Promise<boolean> {
  if (caller.kind !== "user" || !homeworkId) return false;
  const { data: hw } = await admin
    .from("homework_assignments")
    .select("id")
    .eq("id", homeworkId)
    .eq("teacher_id", caller.user.id)
    .maybeSingle();
  return !!hw?.id;
}
