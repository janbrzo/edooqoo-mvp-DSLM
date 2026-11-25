import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { loadTeacherDiagnosticData } from "./claim.ts";
import { ALL_EXERCISE_IDS } from "../_shared/exerciseTaxonomy.ts";
import { executeAiCall, AiGatewayError } from "../_shared/aiGateway.ts";
import { placementOutputSchema, placementPlannerMessages } from "./nextStepsPrompt.ts";
import { createResponsesCall } from "../_shared/lovableResponses.ts";

const text = (max: number) => z.string().max(max).transform(value => value.replace(/\u2014/g, ","));
export const placementSuggestionsSchema = z.array(z.object({
  topic: text(200).refine(value => value.trim().length > 0),
  goal: text(500).nullable(),
  additionalInfo: text(600).nullable(),
  grammarFocus: text(300).nullable(),
  exercises: z.array(z.string().refine(id => ALL_EXERCISE_IDS.includes(id))).length(8),
  exerciseFocusMap: z.record(z.enum(["grammar", "vocabulary", "none"])),
  rationale: text(600).nullable(),
  focusSkills: z.array(text(200)).max(20),
  focusSkillKeys: z.array(text(200)).max(20),
  difficulty: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
  estimatedImpact: z.record(z.unknown()),
})).length(3).refine(items => new Set(items.map(item => item.topic.trim().toLowerCase())).size === 3);

/** Public snapshots never include the reservation secret or private account context. */
export function publicPlacementNextSteps(state: Record<string, unknown> | null | undefined) {
  if (state?.status === "ready") return { status: "ready", suggestions: state.suggestions };
  if (state?.status === "running") return { status: "running" };
  if (state?.status === "failed") return {
    status: "failed", error: state.error,
    retryable: state.terminal !== true && Number(state.attempts ?? 0) < 2,
  };
  return { status: "idle" };
}

/** Separate public planner: only the exact placement diagnostic, never account history. */
export async function completePlacementNextSteps(admin: SupabaseClient, token: string, reservation: { lease: string; studentId: string; testId: string }) {
  let failure = "Could not prepare lesson proposals. Please try again.";
  let terminal = false;
  let suggestions: z.infer<typeof placementSuggestionsSchema> | null = null;
  let context: Record<string, unknown> = {};
  try {
    const diagnostic = await loadTeacherDiagnosticData(admin, reservation.studentId, reservation.testId);
    if (!diagnostic?.learningProfile || diagnostic.test?.status !== "reviewed") throw new Error("Analysis not ready");
    const result = await executeAiCall("placement-next-steps", {
      messages: placementPlannerMessages(diagnostic), outputSchema: placementOutputSchema,
    }, { functionName: "public-placement-report", allowFallback: false,
      responsesExecutor: async (apiKey, model, payload) => {
        const { result } = createResponsesCall(new Request("https://ai.gateway.lovable.dev/v1/responses"), {
          apiKey, model, baseURL: "https://ai.gateway.lovable.dev/v1", schema: placementOutputSchema,
        }, payload.messages.filter(m => m.role !== "system"), payload.messages.filter(m => m.role === "system").map(m => m.content).join("\n\n"));
        let streamError: unknown;
        for await (const part of result.fullStream) {
          if (part.type === "error") streamError = part.error;
        }
        if (streamError) throw streamError;
        return JSON.stringify(await result.output);
      },
    });
    const data = JSON.parse(result.text);
    const wireLesson = z.object({ topic: z.string(), goal: z.string().nullable(), additionalInfo: z.string().nullable(), grammarFocus: z.string().nullable(), rationale: z.string(), difficulty: z.string(), targetQuestionIds: z.array(z.string()), exercises: z.array(z.object({ id: z.string(), focus: z.string() })).length(8) });
    const wire = z.object({ suggestions: z.array(wireLesson).length(3) }).parse(data);
    const parsed = placementSuggestionsSchema.safeParse(wire.suggestions.map(lesson => {
      const targets = diagnostic.questions.filter(q => typeof q.id === "string" && lesson.targetQuestionIds.includes(q.id) && q.student_answer !== null && q.is_correct !== true);
      const skills = [...new Set(targets.flatMap(q => Array.isArray(q.skill_tags) ? q.skill_tags.filter((tag): tag is string => typeof tag === "string") : []))];
      return { ...lesson, exercises: lesson.exercises.map(e => e.id), exerciseFocusMap: Object.fromEntries(lesson.exercises.map(e => [e.id, e.focus])), focusSkills: skills, focusSkillKeys: skills, estimatedImpact: {} };
    }));
    if (!parsed.success) {
      failure = "The planner did not return three complete, distinct lessons. Please try again.";
      throw new Error("Incomplete planner result");
    }
    suggestions = parsed.data;
    context = { model: result.model };
  } catch (error) {
    if (error instanceof AiGatewayError) {
      failure = error.message;
      terminal = !(error.status === 429 || error.status >= 500);
    }
  }
  const { error } = await admin.rpc("finish_placement_next_steps", {
    p_token: token, p_lease: reservation.lease,
    p_suggestions: suggestions, p_context: context,
    p_error: suggestions ? null : failure, p_terminal: terminal,
  });
  // A failed final write keeps the running reservation, never duplicates billed work.
  if (error) throw new Error("Lesson proposal save failed");
}

export async function startPlacementNextSteps(admin: SupabaseClient, token: string) {
  const { data, error } = await admin.rpc("reserve_placement_next_steps", { p_token: token });
  if (error) throw error;
  if (data?.status !== "reserved") return data;
  const task = completePlacementNextSteps(admin, token, data).catch(() => {
    console.warn("[public-placement-report] lesson proposal task failed");
  });
  const runtime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void } }).EdgeRuntime;
  if (runtime) runtime.waitUntil(task);
  else await task;
  return { status: "running" };
}