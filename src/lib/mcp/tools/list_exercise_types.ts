// Public MCP tool — returns the catalog of ESL exercise types Edooqoo can
// generate. Read-only public taxonomy, no user data.
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  NO_MEDIA_EXERCISE_IDS,
  PICTURE_EXERCISE_IDS,
  AUDIO_EXERCISE_IDS,
} from "../../exerciseTaxonomy";

export default defineTool({
  name: "list_exercise_types",
  title: "List Edooqoo exercise types",
  description: "Return the catalog of ESL exercise types Edooqoo can generate, grouped by media requirement (no-media, picture-based, audio-based). Useful for lesson-plan assistants that need to know which exercise formats Edooqoo supports.",
  inputSchema: {
    media: z
      .enum(["all", "no_media", "picture", "audio"]) 
      .default("all")
      .describe("Filter by media requirement. Defaults to all."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ media }) => {
    const groups = {
      no_media: [...NO_MEDIA_EXERCISE_IDS],
      picture: [...PICTURE_EXERCISE_IDS],
      audio: [...AUDIO_EXERCISE_IDS],
    } as const;
    const payload = media === "all" ? groups : { [media]: groups[media] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});