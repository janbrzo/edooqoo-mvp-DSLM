import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { loadTeacherDiagnosticData } from "./claim.ts";
import { executeAiCall, AiGatewayError } from "../_shared/aiGateway.ts";
import { placementLearningPathOutputSchema, placementLearningPathMessages } from "./learningPathPrompt.ts";
import { createResponsesCall } from "../_shared/lovableResponses.ts";

const text = (max: number) => z.string().max(max).transform((value) => value.replace(/\u2014/g, ",").trim());

export const placementPhasesSchema = z.array(
  z.object({
    title: text(200).refine((value) => value.length > 0),
    description: text(500).refine((value) => value.length > 0),
    focusAreas: z.array(text(100).refine((value) => value.length > 0)).min(1).max(6),
    estimatedWeeksStart: z.number().int().min(1).max(104),
    estimatedWeeksEnd: z.number().int().min(1).max(104),
    rationale: text(600).refine((value) => value.length > 0),
  }).refine((phase) => phase.estimatedWeeksEnd >= phase.estimatedWeeksStart, {
    message: "Phase end week must be >= start week",
  }),
)
  .min(3)
  .max(5)
  .refine((items) => new Set(items.map((item) => item.title.toLowerCase())).size === items.length, {
    message: "Phase titles must be distinct",
  })
  .refine((items) => {
    if (items[0]?.estimatedWeeksStart !== 1) return false;
    for (let i = 1; i < items.length; i += 1) {
      if (items[i].estimatedWeeksStart !== items[i - 1].estimatedWeeksEnd + 1) return false;
    }
    return true;
  }, {
    message: "Phase weeks must be contiguous starting at week 1",
  });

/** Public snapshots never include the reservation secret or private account context. */
export function publicPlacementLearningPath(state: Record<string, unknown> | null | undefined) {
  if (state?.status === "ready") return { status: "ready", phases: state.phases };
  if (state?.status === "running") return { status: "running" };
  if (state?.status === "failed") {
    return {
      status: "failed",
      error: state.error,
      retryable: state.terminal !== true && Number(state.attempts ?? 0) < 2,
    };
  }
  return { status: "idle" };
}

/** Separate public roadmap planner: only the exact placement diagnostic, never account history. */
export async function completePlacementLearningPath(
  admin: SupabaseClient,
  token: string,
  reservation: { lease: string; studentId: string; testId: string },
) {
  let failure = "Could not build a learning path. Please try again.";
  let terminal = false;
  let phases: z.infer<typeof placementPhasesSchema> | null = null;
  let context: Record<string, unknown> = {};
  try {
    const diagnostic = await loadTeacherDiagnosticData(admin, reservation.studentId, reservation.testId);
    if (!diagnostic?.learningProfile || diagnostic.test?.status !== "reviewed") {
      throw new Error("Analysis not ready");
    }
    const result = await executeAiCall(
      "placement-learning-path",
      {
        messages: placementLearningPathMessages(diagnostic),
        outputSchema: placementLearningPathOutputSchema,
      },
      {
        functionName: "public-placement-report",
        allowFallback: false,
        responsesExecutor: async (apiKey, model, payload) => {
          const { result: responseResult } = createResponsesCall(
            new Request("https://ai.gateway.lovable.dev/v1/responses"),
            {
              apiKey,
              model,
              baseURL: "https://ai.gateway.lovable.dev/v1",
              schema: placementLearningPathOutputSchema,
            },
            payload.messages.filter((m) => m.role !== "system"),
            payload.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n"),
          );
          let streamError: unknown;
          for await (const part of responseResult.fullStream) {
            if (part.type === "error") streamError = part.error;
          }
          if (streamError) throw streamError;
          return JSON.stringify(await responseResult.output);
        },
      },
    );
    const data = JSON.parse(result.text);
    const wire = z.object({ phases: z.array(z.unknown()) }).parse(data);
    const parsed = placementPhasesSchema.safeParse(wire.phases);
    if (!parsed.success) {
      failure = "The planner did not return a complete, contiguous learning path. Please try again.";
      throw new Error("Incomplete learning path result");
    }
    phases = parsed.data;
    context = { model: result.model, phase_count: phases.length };
  } catch (error) {
    if (error instanceof AiGatewayError) {
      failure = error.message;
      terminal = !(error.status === 429 || error.status >= 500);
    }
  }
  const { error } = await admin.rpc("finish_placement_learning_path", {
    p_token: token,
    p_lease: reservation.lease,
    p_phases: phases,
    p_context: context,
    p_error: phases ? null : failure,
    p_terminal: terminal,
  });
  if (error) throw new Error("Learning path save failed");
}

export async function startPlacementLearningPath(admin: SupabaseClient, token: string) {
  const { data, error } = await admin.rpc("reserve_placement_learning_path", { p_token: token });
  if (error) throw error;
  if (data?.status !== "reserved") return data;
  const task = completePlacementLearningPath(admin, token, data).catch(() => {
    console.warn("[public-placement-report] learning path task failed");
  });
  const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime) runtime.waitUntil(task);
  else await task;
  return { status: "running" };
}