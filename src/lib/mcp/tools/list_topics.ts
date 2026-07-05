// Public MCP tool — returns the ESL topic catalog used by Edooqoo's
// programmatic SEO and lesson planning. Read-only public taxonomy.
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import pseoMatrix from "@/data/pseoMatrix.json";

type Topic = { slug: string; label: string; category: string };
const topics = (pseoMatrix as { topics: Topic[] }).topics ?? [];

export default defineTool({
  name: "list_topics",
  title: "List Edooqoo ESL topics",
  description: "Return the Edooqoo ESL topic catalog (grammar, vocabulary, skills). Optionally filter by category or search substring. Useful for suggesting adult 1:1 lesson focus areas.",
  inputSchema: {
    category: z
      .string()
      .optional()
      .describe("Filter by category (e.g. grammar, vocabulary, skills)."),
    query: z
      .string()
      .optional()
      .describe("Case-insensitive substring match on slug or label."),
    limit: z.number().int().min(1).max(60).default(40),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ category, query, limit }) => {
    const q = query?.toLowerCase() ?? "";
    const filtered = topics
      .filter((t) => (category ? t.category === category : true))
      .filter((t) =>
        q ? t.slug.toLowerCase().includes(q) || t.label.toLowerCase().includes(q) : true,
      )
      .slice(0, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
      structuredContent: { topics: filtered, count: filtered.length },
    };
  },
});