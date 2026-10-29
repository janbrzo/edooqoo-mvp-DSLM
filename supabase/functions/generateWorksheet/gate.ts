// Gate stage of the pipeline: what a parsed model answer must satisfy before it
// is normalised and saved. Today these are the structural checks that used to
// sit inline in each mode; deterministic quality checks are observed here (log
// mode only, see observeWorksheetQuality).
import { ENGINE_PROMPT_VERSION } from "./engineVersion.ts";
import { evaluateWorksheetQuality } from "./quality.ts";
import { OPENAI_FALLBACK_MODEL } from "./clients.ts";
import type { ModelRunInfo } from "./providerErrors.ts";

/** Full worksheet (streaming and regular modes). */
export function checkWorksheetStructure(worksheetData: any): void {
  if (!worksheetData.title || !worksheetData.exercises || !Array.isArray(worksheetData.exercises)) {
    throw new Error("Invalid worksheet structure returned from AI");
  }
}

/** Regular mode also insists on the planned count, except when regenerating. */
export function checkExerciseCount(worksheetData: any, exerciseCount: number, isRegeneration: boolean): void {
  if (worksheetData.exercises.length !== exerciseCount && !isRegeneration) {
    throw new Error(`Generated ${worksheetData.exercises.length} exercises instead of required ${exerciseCount}`);
  }
}

/** Batch (add exercise) responses only need the exercises array. */
export function checkBatchStructure(batchData: any): void {
  if (!batchData.exercises || !Array.isArray(batchData.exercises)) {
    throw new Error("Invalid exercises structure in batch response");
  }
}

// ---------------------------------------------------------------------------
// Quality observation (log mode)
//
// ENGINE_GATE_MODE: off | log | enforce (default log). Only observation exists
// today: `enforce` is accepted as plumbing and behaves exactly like `log`
// (with a warning), so no setting can block, change or reject a worksheet.
// Nothing here throws and nothing here changes the parsed worksheet.
// ---------------------------------------------------------------------------

export type GateMode = "off" | "log" | "enforce";

const AI_REPAIR_STEP = /(^|\+)(ai|ai-window|ai-fallback)(\+|$)/;

export function readGateMode(): GateMode {
  try {
    const value = String(Deno.env.get("ENGINE_GATE_MODE") ?? "").trim().toLowerCase();
    if (value === "off" || value === "enforce") return value;
  } catch (_) { /* no environment: default */ }
  return "log";
}

export interface QualityObservation {
  mode: "streaming" | "regular" | "batch";
  /** The parsed model answer, before normalisation. Never modified. */
  worksheet: any;
  expectedCount: number | null;
  formData: any;
  hasMedia: boolean;
  /** False for single-exercise regeneration: count and order are not checked. */
  checkCountAndOrder: boolean;
  /** False when the requested order is not a reliable reference (batch). */
  checkOrder?: boolean;
  /** Requested types in order (batch: the target types); undefined = formData.selectedExercises. */
  requestedTypes?: string[] | null;
  model: string;
  /** Historical repair value (the one other logs and alerts use). */
  repairMethod: string;
  /** Every repair step applied, local ones included. */
  repairDetail: string;
  generationStartTime: number;
  /** What the model calls reported (finish reason, truncation, primary failure). */
  modelInfo?: ModelRunInfo;
}

/** Logs one `engine_quality` JSON line for a parsed worksheet; never throws. */
export function observeWorksheetQuality(obs: QualityObservation): void {
  try {
    const gateMode = readGateMode();
    if (gateMode === "off") return;
    if (gateMode === "enforce") {
      console.warn(JSON.stringify({ engine_gate_warning: "enforce_not_implemented", behaving_as: "log" }));
    }
    const requested = obs.requestedTypes !== undefined
      ? obs.requestedTypes
      : Array.isArray(obs.formData?.selectedExercises) ? obs.formData.selectedExercises : null;
    const { defects, ...checks } = evaluateWorksheetQuality(obs.worksheet, {
      expectedCount: obs.expectedCount,
      requestedTypes: requested,
      hasMedia: obs.hasMedia,
      checkCountAndOrder: obs.checkCountAndOrder,
      checkOrder: obs.checkOrder,
    });
    const clientId = obs.formData?.clientGenerationId;
    console.log(JSON.stringify({
      engine_quality: {
        schema: 1,
        engine_prompt_version: ENGINE_PROMPT_VERSION,
        gate_mode: "log",
        mode: obs.mode,
        model: obs.model || "unknown",
        fallback_used: obs.model.startsWith(OPENAI_FALLBACK_MODEL),
        repair_method: obs.repairMethod,
        repair_detail: obs.repairDetail,
        generation_ms: Date.now() - obs.generationStartTime,
        worksheet_id: null,
        client_generation_id: typeof clientId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(clientId) ? clientId : null,
        has_media: obs.hasMedia,
        checks,
        defects,
        finish_reason: obs.modelInfo?.finishReason ?? null,
        truncated: obs.modelInfo?.truncated ?? false,
        primary_failure: obs.modelInfo?.primaryFailure ?? null,
        fallback_skipped: obs.modelInfo?.fallbackSkipped ?? false,
      },
    }));
  } catch (error) {
    console.warn("engine_quality observation failed:", error instanceof Error ? error.message : "unknown");
  }
}

/**
 * Early warning for repairs that went through a model: a log line only. The
 * alert email (streaming mode, 'ai' and 'ai-fallback') is unchanged.
 */
export function logAiRepairEarlyWarning(
  mode: "streaming" | "regular" | "batch",
  repairMethod: string,
  repairDetail: string,
): void {
  try {
    if (readGateMode() === "off") return;
    if (!AI_REPAIR_STEP.test(repairDetail) && !AI_REPAIR_STEP.test(repairMethod)) return;
    console.warn(JSON.stringify({
      parse_recovered_early_warning: { mode, repair_method: repairMethod, repair_detail: repairDetail },
    }));
  } catch (_) { /* logging only */ }
}
