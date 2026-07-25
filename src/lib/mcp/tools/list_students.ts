import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { resolveTeacherFromRequest, unauthorized } from "../auth";

export default defineTool({
  name: "list_students",
  title: "List my students",
  description:
    "List the calling teacher's students (id, name, CEFR level, main goal, last updated). Read-only. Requires a Personal MCP Token generated in Edooqoo → Settings → Agent integrations (MCP).",
  inputSchema: {
    limit: z.number().int().min(1).max(200).default(50).describe("Max number of students to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const auth = await resolveTeacherFromRequest(ctx);
    if (!auth.ok) return unauthorized(auth.reason);
    const { data, error } = await auth.supabase
      .from("students")
      .select("id, name, english_level, main_goal, native_language, updated_at")
      .eq("teacher_id", auth.teacherId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit ?? 50);
    if (error) {
      return { content: [{ type: "text" as const, text: `DB error: ${error.message}` }], isError: true };
    }
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { students: data ?? [] },
    };
  },
});