// Gate stage of the pipeline: what a parsed model answer must satisfy before it
// is normalised and saved. Today these are the structural checks that used to
// sit inline in each mode; deterministic quality checks hook in here.

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
