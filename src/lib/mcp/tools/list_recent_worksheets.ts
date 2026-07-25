import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveTeacherFromRequest, unauthorized } from "../auth";

export default defineTool({
  name: "list_recent_worksheets",
  title: "List recent worksheets",
  description: "Return the calling teacher's most recent worksheets (optionally scoped to a student). Read-only.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(20),
    student_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, student_id }, ctx) => {
    const auth = await resolveTeacherFromRequest(ctx);
    if (!auth.ok || !auth.supabase || !auth.teacherId) return unauthorized(auth.reason ?? "Unauthorized");
    let q = auth.supabase
      .from("worksheets")
      .select("id, title, student_id, created_at")
      .eq("user_id", auth.teacherId)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (student_id) q = q.eq("student_id", student_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text" as const, text: `DB error: ${error.message}` }], isError: true };
    return { content: [{ type: "text" as const, text: JSON.stringify(data ?? [], null, 2) }], structuredContent: { worksheets: data ?? [] } };
  },
});