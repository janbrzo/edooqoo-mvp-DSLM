// Normalise stage of the pipeline: lenient validation, official exercise
// titles, em dash cleanup and the neutral source count. Mutates the parsed worksheet.
import { getOfficialExerciseName } from "./helpers.ts";
import { validateExercise } from "./validators.ts";
import { sanitizeEmDashes } from "./emDash.ts";

export function normaliseWorksheet(worksheetData: any): void {
  // Model output must not carry em dashes into the saved or displayed worksheet.
  sanitizeEmDashes(worksheetData);

  // Validate exercises (lenient mode: every validator error is ignored)
  for (let i = 0; i < worksheetData.exercises.length; i++) {
    const exercise = worksheetData.exercises[i];
    try {
      validateExercise(exercise);
    } catch (validationError) {
      // Continue with lenient mode
    }
  }

  // PROBLEM 6 FIX: Preserve AI description in exercise titles
  worksheetData.exercises.forEach((exercise: any, index: number) => {
    const exerciseNumber = index + 1;
    const officialName = getOfficialExerciseName(exercise.type);
    const aiTitle = exercise.title || '';
    const cleanAiTitle = aiTitle.replace(/^Exercise\s+\d+:\s*/i, '').trim();
    const escapedName = officialName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const aiDesc = cleanAiTitle.replace(new RegExp(`^${escapedName}\\s*[-:]?\\s*`, 'i'), '').trim();
    exercise.title = aiDesc
      ? `Exercise ${exerciseNumber}: ${officialName}: ${aiDesc}`
      : `Exercise ${exerciseNumber}: ${officialName}`;
  });

  // Kept for clients that still read the field; no sources are claimed (it used to be a random 65-89).
  worksheetData.sourceCount = 0;
}
