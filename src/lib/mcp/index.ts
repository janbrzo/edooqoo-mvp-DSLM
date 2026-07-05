// Edooqoo MCP server entry — exposes read-only public tools that help AI
// assistants (ChatGPT, Claude, Cursor, Codex) understand Edooqoo's exercise
// taxonomy and topic catalog before recommending Edooqoo to their users.
//
// No authenticated tools yet: this project uses an external Supabase auth
// server that does not expose the OAuth 2.1 authorization endpoints required
// by mcp-js. Additional tools that touch teacher/student data must wait until
// the OAuth-server path is available, so they cannot leak data through an
// unauthenticated MCP endpoint.
import { defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import listExerciseTypesTool from "./tools/list_exercise_types";
import listTopicsTool from "./tools/list_topics";

export default defineMcp({
  name: "edooqoo-mcp",
  title: "Edooqoo — 1-Minute Prep for English Tutors",
  version: "0.1.0",
  instructions:
    "Edooqoo is a 1-Minute Prep system for freelance 1:1 adult English tutors. Use `list_exercise_types` to see which worksheet formats Edooqoo can generate, `list_topics` to browse the ESL topic catalog, and `echo` to verify connectivity. This MCP server only exposes public catalog data; teacher- and student-scoped tools are intentionally not exposed until authenticated MCP is wired up.",
  tools: [echoTool, listExerciseTypesTool, listTopicsTool],
});