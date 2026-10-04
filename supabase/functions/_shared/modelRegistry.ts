// Model Registry — single source of truth for every AI model Edooqoo calls.
//
// `audit-llm-models` builds its probe list from this file:
//   - daily mode checks that each model still works (smoke or metadata probe),
//   - monthly mode adds the lifecycle countdown, a scan of the official
//     provider deprecation pages and an LLM advisor that suggests a better or
//     cheaper model per use case.
//
// RULE: every new model id used in supabase/functions/** must be added here
// (AGENTS.md). Lifecycle dates are curated by hand from the official pages
// listed in `sourceUrl`; the monthly deprecation scan flags drift.
//
// Pure data module: no Deno APIs, no remote imports (unit-tested with Vitest).

export type ModelProvider = "openai" | "google" | "google-vertex";

/**
 * How the daily audit verifies a model works.
 * - metadata: GET the provider's model resource (no token spend).
 * - gemini-generate / openai-chat / openai-chat-reasoning / openai-tts:
 *   minimal real inference request (a few tokens / characters).
 */
export type ProbeKind =
  | "metadata"
  | "gemini-generate"
  | "openai-chat"
  | "openai-chat-reasoning"
  | "openai-tts";

export interface ModelLifecycle {
  /** ISO date (YYYY-MM-DD) of the announced shutdown on this API surface, or null. */
  shutdownDate: string | null;
  /** Provider-recommended replacement id, or null. */
  replacement: string | null;
  /**
   * Future dates already reviewed by a human (e.g. "earliest retirement",
   * "or later" notices). The deprecation scan does not flag them again.
   */
  acknowledgedDates?: string[];
  /** Short factual note shown in the audit email. */
  note?: string;
  /** Official page the dates were taken from. */
  sourceUrl: string;
  /** ISO date the entry was last verified against `sourceUrl`. */
  verifiedAt: string;
}

export interface ModelRegistryEntry {
  id: string;
  provider: ModelProvider;
  /** Stable role key, unique per entry (used in reports). */
  role: string;
  /** What the model does for Edooqoo — the advisor judges fitness against this. */
  useCase: string;
  /** Edge functions / shared helpers that call the model. */
  consumers: string[];
  /** True when changing the model touches the protected Worksheet Generation Engine. */
  protectedEngine?: boolean;
  probe: ProbeKind;
  lifecycle: ModelLifecycle;
}

export const DEPRECATION_PAGES: Record<ModelProvider, string> = {
  openai: "https://developers.openai.com/api/docs/deprecations",
  google: "https://ai.google.dev/gemini-api/docs/deprecations",
  "google-vertex": "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/model-versions",
};

export const PRICING_PAGES: Record<ModelProvider, string> = {
  openai: "https://developers.openai.com/api/docs/pricing",
  google: "https://ai.google.dev/gemini-api/docs/pricing",
  "google-vertex": "https://cloud.google.com/vertex-ai/generative-ai/pricing",
};

export const MODEL_REGISTRY: ModelRegistryEntry[] = [
  // ── Google Generative Language API (GEMINI_API_KEY) ──────────────────────
  {
    id: "gemini-2.5-flash",
    provider: "google",
    role: "chat-primary",
    useCase:
      "Primary text model: worksheet JSON generation (streaming, JSON mode, ~30k output tokens), " +
      "open-answer verification, exercise suggestions, knowledge classification, curriculum phases, " +
      "timeline, welcome-test scoring, student profile extraction, image description.",
    consumers: [
      "generateWorksheet",
      "_shared/aiChat.ts",
      "verify-open-answers",
      "suggest-exercises",
      "classify-knowledge-entry",
      "generate-curriculum-phases",
      "generate-timeline",
      "process-welcome-test",
      "extract-student-profile",
      "generate-image",
    ],
    protectedEngine: true,
    probe: "gemini-generate",
    lifecycle: {
      shutdownDate: null,
      replacement: null,
      note:
        "No Gemini API shutdown date; Google limits 2.5 access to existing users. " +
        "The same model on Vertex AI retires 2026-10-20 (not used by Edooqoo).",
      sourceUrl: DEPRECATION_PAGES.google,
      verifiedAt: "2026-10-04",
    },
  },
  {
    id: "gemini-2.5-flash-lite",
    provider: "google",
    role: "chat-lightweight",
    useCase: "Short flashcard translation and fallback image description (low latency, low cost).",
    consumers: ["translate-flashcard", "generate-image"],
    probe: "gemini-generate",
    lifecycle: {
      shutdownDate: null,
      replacement: null,
      note: "No Gemini API shutdown date; Google limits 2.5 access to existing users.",
      sourceUrl: DEPRECATION_PAGES.google,
      verifiedAt: "2026-10-04",
    },
  },

  // ── OpenAI (OPENAI_API_KEY) ──────────────────────────────────────────────
  {
    id: "gpt-4o-mini",
    provider: "openai",
    role: "chat-fallback",
    useCase:
      "Fallback chat model for the aiChat helper, broken-JSON repair in worksheet generation, " +
      "the text step of generate-audio and the extract-student-profile fallback.",
    consumers: ["_shared/aiChat.ts", "generateWorksheet", "generate-audio", "extract-student-profile"],
    protectedEngine: true,
    probe: "openai-chat",
    lifecycle: {
      shutdownDate: null,
      replacement: null,
      sourceUrl: DEPRECATION_PAGES.openai,
      verifiedAt: "2026-10-04",
    },
  },
  {
    id: "gpt-5-mini-2025-08-07",
    provider: "openai",
    role: "worksheet-json-fallback",
    useCase:
      "Fallback worksheet generator when Gemini fails or returns unparseable JSON " +
      "(strict JSON object mode, up to 30k completion tokens).",
    consumers: ["generateWorksheet"],
    protectedEngine: true,
    probe: "openai-chat-reasoning",
    lifecycle: {
      shutdownDate: "2026-12-11",
      replacement: "gpt-5.6-terra",
      sourceUrl: DEPRECATION_PAGES.openai,
      verifiedAt: "2026-10-04",
    },
  },
  {
    id: "gpt-4.1-2025-04-14",
    provider: "openai",
    role: "media-passages",
    useCase: "Reading and listening passage generation in generate-media-exercises.",
    consumers: ["generate-media-exercises"],
    probe: "openai-chat",
    lifecycle: {
      shutdownDate: null,
      replacement: null,
      sourceUrl: DEPRECATION_PAGES.openai,
      verifiedAt: "2026-10-04",
    },
  },
  {
    id: "whisper-1",
    provider: "openai",
    role: "speech-to-text",
    useCase: "Live session speech-to-text (POST /v1/audio/transcriptions).",
    consumers: ["transcribe-audio"],
    probe: "metadata",
    lifecycle: {
      shutdownDate: "2027-02-26",
      replacement: "gpt-transcribe",
      sourceUrl: DEPRECATION_PAGES.openai,
      verifiedAt: "2026-10-04",
    },
  },
  {
    id: "gpt-4o-mini-tts",
    provider: "openai",
    role: "tts-primary",
    useCase: "Primary text-to-speech for listening exercises (POST /v1/audio/speech).",
    consumers: ["generate-audio"],
    probe: "openai-tts",
    lifecycle: {
      shutdownDate: "2027-01-06",
      replacement: "gpt-realtime-2.1-mini",
      note: "Alias resolves to snapshots 2025-03-20 / 2025-12-15, both deprecated. Replacement uses the Realtime API.",
      sourceUrl: DEPRECATION_PAGES.openai,
      verifiedAt: "2026-10-04",
    },
  },
  {
    id: "tts-1",
    provider: "openai",
    role: "tts-secondary",
    useCase: "Welcome-test audio and fallback text-to-speech for generate-audio.",
    consumers: ["generate-welcome-test-audio", "generate-audio"],
    probe: "openai-tts",
    lifecycle: {
      shutdownDate: "2027-01-06",
      replacement: "gpt-realtime-2.1-mini",
      note: "Replacement uses the Realtime API.",
      sourceUrl: DEPRECATION_PAGES.openai,
      verifiedAt: "2026-10-04",
    },
  },

  // ── Google Vertex AI (GEMINI_VERTEX_API_KEY service account) ─────────────
  {
    id: "gemini-2.5-flash-image",
    provider: "google-vertex",
    role: "image-primary",
    useCase: "Worksheet illustration generation (one image per worksheet).",
    consumers: ["generate-image"],
    probe: "metadata",
    lifecycle: {
      shutdownDate: "2027-03-15",
      replacement: "gemini-3.1-flash-lite-image",
      note: "Vertex AI date. The Gemini API variant shut down on 2026-10-02 (not used by Edooqoo).",
      sourceUrl: DEPRECATION_PAGES["google-vertex"],
      verifiedAt: "2026-10-04",
    },
  },
  {
    id: "gemini-3.1-flash-image",
    provider: "google-vertex",
    role: "image-fallback",
    useCase: "Fallback worksheet illustration generation (Nano Banana 2).",
    consumers: ["generate-image"],
    probe: "metadata",
    lifecycle: {
      shutdownDate: null,
      replacement: null,
      acknowledgedDates: ["2027-05-28"],
      note: "Vertex lists the earliest retirement as 2027-05-28 \"or later\".",
      sourceUrl: DEPRECATION_PAGES["google-vertex"],
      verifiedAt: "2026-10-04",
    },
  },
];

/**
 * Runtime model overrides read from project secrets. When one is set to an id
 * that is not in the registry the audit probes it and flags it for review.
 */
export const MODEL_ENV_OVERRIDES: Array<{
  envVar: string;
  provider: ModelProvider;
  role: string;
  /** Values the consumer rewrites to a registry model (see generate-image normalizeImageModel). */
  ignoredValues?: string[];
}> = [
  {
    envVar: "GEMINI_IMAGE_MODEL",
    provider: "google-vertex",
    role: "image-primary-override",
    ignoredValues: ["gemini-3.1-flash-image-preview"],
  },
  { envVar: "GEMINI_DESCRIPTION_MODEL", provider: "google", role: "image-description-override" },
];
