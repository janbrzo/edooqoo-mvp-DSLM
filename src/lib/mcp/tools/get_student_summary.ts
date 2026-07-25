import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveTeacherFromRequest, unauthorized } from "../auth";

export default defineTool({
  name: "get_student_summary",
  title: "Get student summary",
  description:
    "Return a full read-only summary for one student the calling teacher owns: profile fields, top skill metrics (by mastery), and the 5 most recent worksheets. Requires a Personal MCP Token.",
  inputSchema: {
    student_id: z.string().uuid().describe("UUID of the student. Get one from list_students."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ student_id }, ctx) => {
    const auth = await resolveTeacherFromRequest(ctx);
    if (!auth.ok || !auth.supabase || !auth.teacherId) return unauthorized(auth.reason ?? "Unauthorized");

    const { data: student, error: sErr } = await auth.supabase
      .from("students")
      .select("id, name, english_level, main_goal, main_goal_target_date, native_language, created_at, updated_at")
      .eq("id", student_id)
      .eq("teacher_id", auth.teacherId)
      .is("deleted_at", null)
      .maybeSingle();
    if (sErr) return { content: [{ type: "text" as const, text: `DB error: ${sErr.message}` }], isError: true };
    if (!student) return { content: [{ type: "text" as const, text: "Student not found or not owned by you." }], isError: true };

    const { data: skills } = await auth.supabase
      .from("student_skill_metrics")
      .select("skill_name, skill_category, current_mastery, trend, total_events")
      .eq("student_id", student_id)
      .eq("teacher_id", auth.teacherId)
      .order("current_mastery", { ascending: false })
      .limit(10);

    const { data: worksheets } = await auth.supabase
      .from("worksheets")
      .select("id, title, created_at")
      .eq("student_id", student_id)
      .eq("user_id", auth.teacherId)
      .order("created_at", { ascending: false })
      .limit(5);

    const summary = { student, top_skills: skills ?? [], recent_worksheets: worksheets ?? [] };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});