// Public MCP tool — returns the ESL topic catalog used by Edooqoo's
// programmatic SEO and lesson planning. Read-only public taxonomy.
// Topic list mirrored from src/data/pseoMatrix.json (inlined so the emitted
// Deno function does not need a JSON import assertion).
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

type Topic = { slug: string; label: string; category: string };
const TOPICS: Topic[] = [{"slug": "present-perfect", "label": "Present Perfect", "category": "grammar"}, {"slug": "past-simple", "label": "Past Simple", "category": "grammar"}, {"slug": "conditionals", "label": "Conditionals", "category": "grammar"}, {"slug": "modal-verbs", "label": "Modal Verbs", "category": "grammar"}, {"slug": "phrasal-verbs", "label": "Phrasal Verbs", "category": "grammar"}, {"slug": "reported-speech", "label": "Reported Speech", "category": "grammar"}, {"slug": "passive-voice", "label": "Passive Voice", "category": "grammar"}, {"slug": "articles", "label": "Articles (a / an / the)", "category": "grammar"}, {"slug": "prepositions", "label": "Prepositions", "category": "grammar"}, {"slug": "comparatives", "label": "Comparatives and Superlatives", "category": "grammar"}, {"slug": "gerunds-infinitives", "label": "Gerunds and Infinitives", "category": "grammar"}, {"slug": "relative-clauses", "label": "Relative Clauses", "category": "grammar"}, {"slug": "business-email", "label": "Business Email Writing", "category": "business"}, {"slug": "job-interview", "label": "Job Interview English", "category": "business"}, {"slug": "small-talk", "label": "Small Talk", "category": "business"}, {"slug": "meetings", "label": "Meetings English", "category": "business"}, {"slug": "negotiations", "label": "Negotiations English", "category": "business"}, {"slug": "presentations", "label": "Presentation English", "category": "business"}, {"slug": "travel-vocabulary", "label": "Travel Vocabulary", "category": "vocabulary"}, {"slug": "food-restaurant", "label": "Food and Restaurant Vocabulary", "category": "vocabulary"}, {"slug": "shopping", "label": "Shopping Vocabulary", "category": "vocabulary"}, {"slug": "health-doctor", "label": "Health and Doctor Visits", "category": "vocabulary"}, {"slug": "weather", "label": "Weather Vocabulary", "category": "vocabulary"}, {"slug": "daily-routines", "label": "Daily Routines", "category": "vocabulary"}, {"slug": "hobbies", "label": "Hobbies and Free Time", "category": "vocabulary"}, {"slug": "family", "label": "Family Vocabulary", "category": "vocabulary"}, {"slug": "work-office", "label": "Work and Office Vocabulary", "category": "vocabulary"}, {"slug": "technology", "label": "Technology Vocabulary", "category": "vocabulary"}, {"slug": "environment", "label": "Environment and Sustainability", "category": "vocabulary"}, {"slug": "news-media", "label": "News and Media", "category": "vocabulary"}, {"slug": "idioms", "label": "English Idioms", "category": "vocabulary"}, {"slug": "collocations", "label": "Collocations", "category": "vocabulary"}, {"slug": "phrasal-business", "label": "Business Phrasal Verbs", "category": "business"}, {"slug": "formal-informal", "label": "Formal vs Informal English", "category": "skills"}, {"slug": "telephone-english", "label": "Telephone English", "category": "business"}, {"slug": "cv-resume", "label": "CV and Resume Writing", "category": "business"}, {"slug": "public-speaking", "label": "Public Speaking", "category": "skills"}, {"slug": "conflict-resolution", "label": "Conflict Resolution English", "category": "business"}, {"slug": "cross-cultural", "label": "Cross-Cultural Communication", "category": "skills"}, {"slug": "ielts-writing-task-2", "label": "IELTS Writing Task 2", "category": "exam"}];

export default defineTool({
  name: "list_topics",
  title: "List Edooqoo ESL topics",
  description: "Return the Edooqoo ESL topic catalog (grammar, vocabulary, skills). Optionally filter by category or search substring. Useful for suggesting adult 1:1 lesson focus areas.",
  inputSchema: {
    category: z.string().optional().describe("Filter by category (e.g. grammar, vocabulary, skills)."),
    query: z.string().optional().describe("Case-insensitive substring match on slug or label."),
    limit: z.number().int().min(1).max(60).default(40),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ category, query, limit }) => {
    const q = query?.toLowerCase() ?? "";
    const filtered = TOPICS
      .filter((t) => (category ? t.category === category : true))
      .filter((t) => (q ? t.slug.toLowerCase().includes(q) || t.label.toLowerCase().includes(q) : true))
      .slice(0, limit);
    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
      structuredContent: { topics: filtered, count: filtered.length },
    };
  },
});
