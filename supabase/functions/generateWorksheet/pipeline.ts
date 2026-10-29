// The single generation pipeline shared by the batch, streaming and regular
// modes:
//
//   model call -> parse -> gate -> normalise -> persist -> respond
//
// A mode supplies the stages (its transport, logging and failure policy); the
// order of the stages and the boundary of the processing guard live here only.
// Errors from the model call and from persist/respond propagate to the caller;
// errors from parse, gate and normalise go to `onProcessingError`, which either
// rethrows or turns them into the mode's outcome.

export interface PipelineStages<TRaw, TParsed, TSaved, TOutcome> {
  /** Calls the model (with fallbacks) and returns the raw answer. */
  callModel(): Promise<TRaw>;
  /** Parses the raw answer, repairing it when needed. */
  parse(raw: TRaw): Promise<TParsed>;
  /** Refuses a parsed answer that does not meet the contract (throws). */
  gate(parsed: TParsed): void | Promise<void>;
  /** Mutates the parsed answer into its final shape. */
  normalise(parsed: TParsed): void;
  /** Handles an error thrown by parse, gate or normalise. */
  onProcessingError(error: unknown): TOutcome;
  /** Saves the result (no-op for modes that do not save). */
  persist(parsed: TParsed, raw: TRaw): Promise<TSaved>;
  /** Builds the mode's outcome (HTTP response or SSE done event). */
  respond(parsed: TParsed, saved: TSaved): TOutcome;
}

export async function runPipeline<TRaw, TParsed, TSaved, TOutcome>(
  stages: PipelineStages<TRaw, TParsed, TSaved, TOutcome>,
): Promise<TOutcome> {
  const raw = await stages.callModel();

  let parsed: TParsed;
  try {
    parsed = await stages.parse(raw);
    const gated = stages.gate(parsed);
    if (gated instanceof Promise) await gated;
    stages.normalise(parsed);
  } catch (error) {
    return stages.onProcessingError(error);
  }

  const saved = await stages.persist(parsed, raw);
  return stages.respond(parsed, saved);
}
